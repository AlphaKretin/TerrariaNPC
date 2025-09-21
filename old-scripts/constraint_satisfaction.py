import argparse
import itertools
import json
import math
import random
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Dict, List, Set, Tuple


@dataclass
class Constraint:
    """Represents a single NPC preference constraint."""

    npc: str  # The NPC with this preference
    constraint_type: str  # "biome", "love_npc", "like_npc", "dislike_npc", "hate_npc"
    target: str  # The biome or NPC this constraint refers to
    weight: float  # The importance of this constraint (1.0 for likes, 2.0 for loves, -1.0 for dislikes, -2.0 for hates)


@dataclass
class House:
    """Represents a house with a specific biome and the NPCs living in it."""

    biome: str
    npcs: List[str]


class ConstraintSolver:
    def __init__(self, npc_data: dict):
        """Initialize the solver with NPC preference data."""
        self.npc_data = npc_data
        self.constraints = self._extract_constraints()

    def _extract_constraints(self) -> List[Constraint]:
        """Extract all constraints from NPC data."""
        constraints = []

        for npc, prefs in self.npc_data.items():
            # Biome preferences
            for biome, score in prefs["biome"].items():
                if score != 0:  # Only consider non-neutral preferences
                    constraints.append(
                        Constraint(
                            npc=npc,
                            constraint_type="biome",
                            target=biome,
                            weight=float(score),  # 1.0 for likes, 2.0 for loves
                        )
                    )

            # NPC preferences
            # In the JSON, NPC relationships are stored directly with their scores
            for other_npc, score in prefs["npc"].items():
                relationship_type = ""
                if score == 2:
                    relationship_type = "love_npc"
                elif score == 1:
                    relationship_type = "like_npc"
                elif score == -1:
                    relationship_type = "dislike_npc"
                elif score == -2:
                    relationship_type = "hate_npc"
                else:
                    continue  # Skip neutral relationships

                constraints.append(
                    Constraint(
                        npc=npc,
                        constraint_type=relationship_type,
                        target=other_npc,
                        weight=float(score),
                    )
                )

        return constraints

    def evaluate_constraint_satisfaction(
        self, housing: List[House], biome_weight_factor: float = 1.5
    ) -> Tuple[int, int, float]:
        """
        Evaluate how many constraints are satisfied by the housing arrangement.

        Args:
            housing: The housing arrangement to evaluate
            biome_weight_factor: Factor to increase the importance of biome preferences

        Returns:
            Tuple containing:
            - Number of satisfied constraints
            - Total number of constraints
            - Weighted satisfaction score
        """
        satisfied = 0
        total = len(self.constraints)
        weighted_score = 0.0

        # Create a lookup for NPC locations
        npc_to_house = {}
        for i, house in enumerate(housing):
            for npc in house.npcs:
                npc_to_house[npc] = i

        # Track which NPCs prefer which biomes for opportunity cost calculation
        biome_preferences = {}
        for constraint in self.constraints:
            if constraint.constraint_type == "biome" and constraint.weight > 0:
                if constraint.target not in biome_preferences:
                    biome_preferences[constraint.target] = []
                biome_preferences[constraint.target].append(constraint.npc)

        # Calculate biome opportunity cost - penalize when NPCs are in suboptimal biomes
        # especially when those biomes are preferred by other NPCs who aren't there
        biome_opportunity_cost = 0.0
        biome_utilization = {}

        # Initialize biome utilization tracking
        for biome in biome_preferences:
            biome_utilization[biome] = {
                "npcs_who_like_it": set(biome_preferences[biome]),
                "npcs_actually_there": set(),
            }

        # Track which NPCs are actually in each biome
        for house in housing:
            if house.biome in biome_utilization:
                for npc in house.npcs:
                    biome_utilization[house.biome]["npcs_actually_there"].add(npc)

        # Calculate opportunity cost penalties for each biome
        for biome, util_data in biome_utilization.items():
            # NPCs who like this biome but aren't there
            displaced_npcs = (
                util_data["npcs_who_like_it"] - util_data["npcs_actually_there"]
            )

            # NPCs who are there but don't like this biome
            misplaced_npcs = (
                util_data["npcs_actually_there"] - util_data["npcs_who_like_it"]
            )

            # The more displaced NPCs, the higher the opportunity cost
            biome_opportunity_cost += len(displaced_npcs) * 0.5

            # The more misplaced NPCs, the higher the opportunity cost
            biome_opportunity_cost += len(misplaced_npcs) * 0.5

        for constraint in self.constraints:
            # Skip constraints for NPCs not in the housing arrangement
            if constraint.npc not in npc_to_house:
                total -= 1
                continue

            # Skip constraints targeting NPCs not in the arrangement
            if (
                "npc" in constraint.constraint_type
                and constraint.target not in npc_to_house
            ):
                total -= 1
                continue

            npc_house = housing[npc_to_house[constraint.npc]]

            # Check biome constraints with increased weight
            if constraint.constraint_type == "biome":
                if npc_house.biome == constraint.target:
                    satisfied += 1
                    # Apply biome weight factor to increase importance of biome preferences
                    weighted_score += constraint.weight * biome_weight_factor

                # Special penalty for pairs that both like specific biomes but are placed elsewhere
                # For example, if A and B both like biome X but are placed in biome Y
                elif constraint.weight > 0:  # If this NPC likes a biome they're not in
                    # Check if any NPC they are with also likes the same biome
                    for other_npc in npc_house.npcs:
                        if other_npc != constraint.npc:
                            # Look for shared biome preference
                            for other_constraint in self.constraints:
                                if (
                                    other_constraint.npc == other_npc
                                    and other_constraint.constraint_type == "biome"
                                    and other_constraint.target == constraint.target
                                    and other_constraint.weight > 0
                                ):
                                    # Both NPCs like the same biome but aren't there
                                    weighted_score -= 0.5  # Small penalty

            # Check NPC neighbor constraints
            elif constraint.constraint_type in [
                "love_npc",
                "like_npc",
                "dislike_npc",
                "hate_npc",
            ]:
                target_house_idx = npc_to_house.get(constraint.target)
                if target_house_idx is not None:
                    # If the target NPC is in the same house, the constraint is satisfied for love/like
                    # or violated for dislike/hate
                    is_same_house = npc_to_house[constraint.npc] == target_house_idx

                    if (is_same_house and constraint.weight > 0) or (
                        not is_same_house and constraint.weight < 0
                    ):
                        satisfied += 1
                        weighted_score += abs(constraint.weight)

                        # Special bonus for relationships in optimal biome
                        if is_same_house and constraint.weight > 0:
                            # Check if either NPC prefers this biome
                            npc_house = housing[npc_to_house[constraint.npc]]
                            for biome_constraint in self.constraints:
                                if (
                                    biome_constraint.constraint_type == "biome"
                                    and biome_constraint.target == npc_house.biome
                                    and biome_constraint.weight > 0
                                    and (
                                        biome_constraint.npc == constraint.npc
                                        or biome_constraint.npc == constraint.target
                                    )
                                ):
                                    # Extra bonus for placing friends in a biome one of them likes
                                    weighted_score += 0.5

        # Apply the opportunity cost to the weighted score
        final_weighted_score = weighted_score - biome_opportunity_cost

        return satisfied, total, final_weighted_score

    def is_valid_housing(self, housing: List[House]) -> bool:
        """Check if a housing arrangement is valid."""
        # Check if each NPC is assigned exactly once
        all_npcs = [npc for house in housing for npc in house.npcs]
        if len(all_npcs) != len(set(all_npcs)):
            return False

        # Check if each house has at least 2 NPCs
        if any(len(house.npcs) < 2 for house in housing):
            return False

        # Check if Truffle is in a mushroom biome
        for house in housing:
            if "truffle" in house.npcs and house.biome != "mushroom":
                return False

        # Check if we have only one house per biome
        biomes = [house.biome for house in housing]
        if len(biomes) != len(set(biomes)):
            return False

        return True

    def get_neighbor_solution(
        self, housing: List[House], move_probability: float = 0.3
    ) -> List[House]:
        """Generate a neighboring solution by swapping NPCs or moving an NPC."""
        housing_copy = deepcopy(housing)

        # Decide whether to do a swap or move operation
        if random.random() < move_probability:
            # Move operation: Move one NPC from one house to another
            source_idx = random.randint(0, len(housing_copy) - 1)
            dest_idx = random.randint(0, len(housing_copy) - 1)

            # Skip if source house would have fewer than 2 NPCs after move
            if len(housing_copy[source_idx].npcs) <= 2:
                return housing_copy

            # Pick a random NPC to move
            npc_idx = random.randint(0, len(housing_copy[source_idx].npcs) - 1)
            npc_to_move = housing_copy[source_idx].npcs[npc_idx]

            # Skip moving Truffle out of mushroom biome
            if (
                npc_to_move == "truffle"
                and housing_copy[source_idx].biome == "mushroom"
            ):
                return housing_copy

            # Move the NPC
            housing_copy[source_idx].npcs.remove(npc_to_move)
            housing_copy[dest_idx].npcs.append(npc_to_move)
        else:
            # Swap operation: Swap two NPCs between houses
            house1_idx = random.randint(0, len(housing_copy) - 1)
            house2_idx = random.randint(0, len(housing_copy) - 1)

            # Skip if same house
            if house1_idx == house2_idx:
                return housing_copy

            npc1_idx = random.randint(0, len(housing_copy[house1_idx].npcs) - 1)
            npc2_idx = random.randint(0, len(housing_copy[house2_idx].npcs) - 1)

            npc1 = housing_copy[house1_idx].npcs[npc1_idx]
            npc2 = housing_copy[house2_idx].npcs[npc2_idx]

            # Skip if swapping would move Truffle out of mushroom
            if (npc1 == "truffle" and housing_copy[house1_idx].biome == "mushroom") or (
                npc2 == "truffle" and housing_copy[house2_idx].biome == "mushroom"
            ):
                return housing_copy

            # Perform the swap
            housing_copy[house1_idx].npcs[npc1_idx] = npc2
            housing_copy[house2_idx].npcs[npc2_idx] = npc1

        return housing_copy

    def solve(
        self,
        available_biomes: List[str],
        max_iterations: int = 10000,
        initial_temperature: float = 2.0,
        cooling_rate: float = 0.995,
        move_probability: float = 0.3,
        reheat_cycles: int = 3,
        restarts: int = 1,
        biome_weight_factor: float = 1.5,
    ) -> Tuple[List[House] | None, int, int, float]:
        """
        Solve the constraint satisfaction problem using simulated annealing.

        Args:
            available_biomes: List of available biomes
            max_iterations: Maximum number of iterations
            initial_temperature: Initial temperature for simulated annealing
            cooling_rate: Cooling rate for simulated annealing
            move_probability: Probability of performing a move vs swap operation
            reheat_cycles: Number of temperature resets during optimization
            restarts: Number of times to restart with different initial solutions
            biome_weight_factor: Factor to increase importance of biome preferences

        Returns:
            Tuple containing:
            - Best housing arrangement
            - Number of satisfied constraints
            - Total number of constraints
            - Weighted satisfaction score
        """
        import math  # Import math module here

        all_npcs = list(self.npc_data.keys())

        def create_initial_solution():
            """Create an initial valid housing arrangement."""
            houses = []
            remaining_npcs = all_npcs.copy()
            remaining_biomes = available_biomes.copy()

            # First place Truffle in mushroom biome if applicable
            if "truffle" in remaining_npcs and "mushroom" in remaining_biomes:
                mushroom_npcs = ["truffle"]
                remaining_npcs.remove("truffle")

                # Add a second NPC to the mushroom biome
                if remaining_npcs:
                    additional_npc = random.choice(remaining_npcs)
                    mushroom_npcs.append(additional_npc)
                    remaining_npcs.remove(additional_npc)

                houses.append(House(biome="mushroom", npcs=mushroom_npcs))
                remaining_biomes.remove("mushroom")

            # Distribute remaining NPCs evenly
            random.shuffle(remaining_npcs)
            npcs_per_house = len(remaining_npcs) // len(remaining_biomes)
            extra_npcs = len(remaining_npcs) % len(remaining_biomes)

            idx = 0
            for biome in remaining_biomes:
                house_size = npcs_per_house + (1 if extra_npcs > 0 else 0)
                house_npcs = remaining_npcs[idx : idx + house_size]
                houses.append(House(biome=biome, npcs=house_npcs))
                idx += house_size
                extra_npcs -= 1

            return houses

        best_solution = None
        best_satisfied = 0
        best_total = 0
        best_weighted_score = 0.0

        for restart in range(restarts):
            print(f"\nStarting constraint optimization run {restart+1}/{restarts}")

            # Initialize with a valid solution
            current_solution = create_initial_solution()
            attempts = 0
            while not self.is_valid_housing(current_solution) and attempts < 10:
                current_solution = create_initial_solution()
                attempts += 1

            if not self.is_valid_housing(current_solution):
                print("Failed to create a valid initial solution. Skipping this run.")
                continue

            # Evaluate initial solution
            satisfied, total, weighted_score = self.evaluate_constraint_satisfaction(
                current_solution, biome_weight_factor
            )
            print(
                f"Initial solution: {satisfied}/{total} constraints satisfied, Score: {weighted_score:.2f}"
            )

            # Set up for simulated annealing
            temperature = initial_temperature
            iterations_per_cycle = max_iterations // reheat_cycles

            # For adaptive cooling
            slow_cooling = cooling_rate
            fast_cooling = cooling_rate**0.5
            current_cooling = slow_cooling

            # For progress tracking
            report_interval = max(1, max_iterations // 20)
            last_report_time = time.time()
            last_improvement_time = time.time()
            improvements = 0

            print(
                f"\nStarting optimization with {max_iterations} iterations ({reheat_cycles} heating cycles)..."
            )

            for i in range(max_iterations):
                # Check if it's time for a temperature reset (reheat)
                if i > 0 and i % iterations_per_cycle == 0:
                    old_temp = temperature
                    cycle = i // iterations_per_cycle
                    temperature = initial_temperature * (0.8**cycle)

                    print(
                        f"\n--- Reheating at iteration {i}: {old_temp:.6f} -> {temperature:.6f} ---"
                    )

                    # If no improvements in a while, try a more drastic change
                    if time.time() - last_improvement_time > 30:
                        print(
                            "No recent improvements, attempting a more drastic rearrangement..."
                        )
                        temp_solution = create_initial_solution()
                        if self.is_valid_housing(temp_solution):
                            # 20% chance to use the new solution anyway
                            if random.random() < 0.2:
                                current_solution = temp_solution
                                satisfied, total, weighted_score = (
                                    self.evaluate_constraint_satisfaction(
                                        current_solution, biome_weight_factor
                                    )
                                )

                # Generate a neighbor solution
                neighbor = self.get_neighbor_solution(
                    current_solution, move_probability
                )

                # Skip invalid solutions
                if not self.is_valid_housing(neighbor):
                    continue

                # Evaluate neighbor
                neighbor_satisfied, neighbor_total, neighbor_weighted_score = (
                    self.evaluate_constraint_satisfaction(neighbor, biome_weight_factor)
                )

                # Decide whether to accept the new solution
                if (
                    neighbor_weighted_score > weighted_score
                    or random.random()
                    < math.exp((neighbor_weighted_score - weighted_score) / temperature)
                ):
                    current_solution = neighbor
                    satisfied = neighbor_satisfied
                    total = neighbor_total
                    weighted_score = neighbor_weighted_score

                    # Check if this is a new best
                    if weighted_score > best_weighted_score:
                        best_solution = deepcopy(current_solution)
                        best_satisfied = satisfied
                        best_total = total
                        best_weighted_score = weighted_score
                        improvements += 1
                        last_improvement_time = time.time()
                        current_cooling = (
                            slow_cooling  # Slow down cooling when making progress
                        )

                # Cool the temperature
                temperature *= current_cooling

                # Progress reporting
                if (i + 1) % report_interval == 0:
                    elapsed = time.time() - last_report_time
                    completion = (i + 1) / max_iterations * 100
                    print(
                        f"Progress: {completion:.1f}% complete. Current temperature: {temperature:.6f}"
                    )
                    print(
                        f"Current solution: {satisfied}/{total} constraints satisfied, Score: {weighted_score:.2f}"
                    )
                    print(
                        f"Best score so far: {best_weighted_score:.2f}, Improvements: {improvements}"
                    )
                    print(f"Time for last {report_interval} iterations: {elapsed:.2f}s")
                    last_report_time = time.time()
                    improvements = 0

                    # Adjust cooling rate based on progress
                    if time.time() - last_improvement_time > 15:
                        current_cooling = fast_cooling  # Speed up cooling if stuck

            print(
                f"Run {restart+1} completed: {satisfied}/{total} constraints satisfied, Score: {weighted_score:.2f}"
            )

        return best_solution, best_satisfied, best_total, best_weighted_score


def load_vanilla_npcs() -> dict:
    """Load NPC data from vanilla.json"""
    try:
        with open("vanilla.json", "r") as file:
            vanilla_npcs = json.load(file)
            return vanilla_npcs
    except FileNotFoundError:
        print("Error: vanilla.json file not found")
        return {}
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in vanilla.json")
        return {}


def load_calamity_npcs(npcs: dict) -> None:
    """Load and merge Calamity NPC data if available"""
    try:
        with open("calamity.json", "r") as file:
            calamity_npcs = json.load(file)
        if npcs:
            npcs.update(calamity_npcs)
    except FileNotFoundError:
        print("Error: calamity.json file not found")
    except json.JSONDecodeError:
        print("Error: Invalid JSON format in calamity.json")


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Optimize NPC housing in Terraria using constraint satisfaction"
    )
    parser.add_argument(
        "--calamity", action="store_true", help="Include Calamity mod NPCs"
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=10000,
        help="Number of iterations for the optimization algorithm",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=2.0,
        help="Initial temperature for simulated annealing",
    )
    parser.add_argument(
        "--cooling-rate",
        type=float,
        default=0.995,
        help="Cooling rate for simulated annealing (0.9-0.9999)",
    )
    parser.add_argument(
        "--restarts",
        type=int,
        default=1,
        help="Number of times to restart the optimization with different initial solutions",
    )
    parser.add_argument(
        "--move-prob",
        type=float,
        default=0.3,
        help="Probability of choosing a move operation vs. swap (0.0 = always swap, 1.0 = always move)",
    )
    parser.add_argument(
        "--reheat-cycles",
        type=int,
        default=3,
        help="Number of temperature reheat cycles during optimization to escape local optima",
    )
    parser.add_argument(
        "--biome-weight",
        type=float,
        default=1.5,
        help="Factor to increase importance of biome preferences (1.0 = normal, higher values prioritize biomes)",
    )
    return parser.parse_args()


def print_housing_arrangement(
    housing: List[House] | None, npc_data: dict, solver: ConstraintSolver
):
    """Print the housing arrangement and satisfied constraints."""
    if not housing:
        print("No valid housing arrangement found.")
        return
    print("\nOptimal NPC Housing Arrangement:")
    print("-" * 40)

    npc_to_house = {}
    for i, house in enumerate(housing):
        for npc in house.npcs:
            npc_to_house[npc] = i

    for house in housing:
        print(f"\nBiome: {house.biome.upper()}")
        print("NPCs:")
        for npc in house.npcs:
            print(f"  - {npc.replace('_', ' ').title()}")
        print()

        # Show satisfied constraints for this house
        print("Satisfied constraints:")
        for constraint in solver.constraints:
            if constraint.npc in house.npcs:
                # Biome constraints
                if (
                    constraint.constraint_type == "biome"
                    and constraint.target == house.biome
                ):
                    relationship = "loves" if constraint.weight > 1 else "likes"
                    print(
                        f"  - {constraint.npc.replace('_', ' ').title()} {relationship} {house.biome} biome"
                    )

                # NPC relationship constraints (for NPCs in same house)
                elif (
                    constraint.constraint_type in ["love_npc", "like_npc"]
                    and constraint.target in house.npcs
                ):
                    relationship = "loves" if constraint.weight > 1 else "likes"
                    print(
                        f"  - {constraint.npc.replace('_', ' ').title()} {relationship} {constraint.target.replace('_', ' ').title()}"
                    )

        # Show negative constraints avoided (NPCs that hate each other are in different houses)
        print("Avoided negative interactions:")
        for constraint in solver.constraints:
            if constraint.npc in house.npcs and constraint.constraint_type in [
                "dislike_npc",
                "hate_npc",
            ]:
                if (
                    constraint.target in npc_to_house
                    and npc_to_house[constraint.target] != npc_to_house[constraint.npc]
                ):
                    relationship = "hates" if constraint.weight < -1 else "dislikes"
                    print(
                        f"  - {constraint.npc.replace('_', ' ').title()} {relationship} {constraint.target.replace('_', ' ').title()} (kept apart)"
                    )


def main():
    import math  # Import here to avoid global namespace pollution

    # Load NPC data
    npc_data = load_vanilla_npcs()
    if not npc_data:
        return

    args = parse_args()
    if args.calamity:
        load_calamity_npcs(npc_data)

    # Available biomes
    available_biomes = [
        "forest",
        "desert",
        "snow",
        "jungle",
        "ocean",
        "hallow",
        "underground",
        "mushroom",
    ]

    if args.calamity:
        available_biomes += ["sulphur", "astral", "brimstone", "sunken"]

    # Print settings before optimization
    print("Starting NPC constraint satisfaction with the following settings:")
    print(f"Number of NPCs: {len(npc_data)}")
    print(f"Available biomes: {', '.join(available_biomes)}")
    print(f"Calamity mod: {'Enabled' if args.calamity else 'Disabled'}")
    print(f"Iterations per run: {args.iterations}")
    print(f"Number of restarts: {args.restarts}")
    print(f"Initial temperature: {args.temperature}")
    print(f"Cooling rate: {args.cooling_rate}")
    print(f"Move operation probability: {args.move_prob}")
    print(f"Reheat cycles: {args.reheat_cycles}")
    print(f"Biome weight factor: {args.biome_weight}")

    # Create solver
    solver = ConstraintSolver(npc_data)

    # Extract and analyze constraints
    positive_constraints = sum(1 for c in solver.constraints if c.weight > 0)
    negative_constraints = sum(1 for c in solver.constraints if c.weight < 0)
    biome_constraints = sum(
        1 for c in solver.constraints if c.constraint_type == "biome"
    )
    npc_constraints = len(solver.constraints) - biome_constraints

    print(f"\nTotal constraints: {len(solver.constraints)}")
    print(f"  - Positive constraints: {positive_constraints}")
    print(f"  - Negative constraints: {negative_constraints}")
    print(f"  - Biome preferences: {biome_constraints}")
    print(f"  - NPC relationships: {npc_constraints}")

    # Solve the constraint satisfaction problem
    try:
        best_housing, satisfied, total, weighted_score = solver.solve(
            available_biomes=available_biomes,
            max_iterations=args.iterations,
            initial_temperature=args.temperature,
            cooling_rate=args.cooling_rate,
            move_probability=args.move_prob,
            reheat_cycles=args.reheat_cycles,
            restarts=args.restarts,
            biome_weight_factor=args.biome_weight,
        )

        print("\nConstraint satisfaction complete!")
        print(f"Satisfied {satisfied}/{total} constraints ({satisfied/total*100:.1f}%)")
        print(f"Weighted satisfaction score: {weighted_score:.2f}")

        # Print the best housing arrangement if found
        if best_housing:
            print_housing_arrangement(best_housing, npc_data, solver)
        else:
            print("\nNo valid housing arrangement found. Try adjusting parameters.")

    except Exception as e:
        print(f"Error during optimization: {e}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback

        print(f"Error: {e}")
        traceback.print_exc()
