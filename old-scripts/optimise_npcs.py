import argparse
import itertools
import json
import random
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Dict, List, Set


@dataclass
class House:
    biome: str
    npcs: List[str]

    def score(
        self, npc_data, exaggerate_factor: float = 1.0, use_average: bool = True
    ) -> float:
        """Calculate the happiness score for the house.

        Args:
            npc_data: Dictionary containing NPC preference data
            exaggerate_factor: Factor to exaggerate preferences (1.0 = game values)
            use_average: If True, return average NPC happiness; if False, return total
        """
        if len(self.npcs) < 2:
            return 0.0  # Invalid house configuration - enforce minimum 2 NPCs

        total_score = 0
        for npc in self.npcs:
            total_score += score_npc(npc, self, npc_data, exaggerate_factor)

        # Return average score per NPC if requested
        if use_average:
            return total_score / len(self.npcs)
        else:
            return total_score


class Housing:
    def __init__(self, houses: List[House], npc_data: dict):
        self.houses = houses
        self.npc_data = npc_data

    def is_valid(self) -> bool:
        """Check if the housing arrangement is valid."""
        # Check if we have at least 2 NPCs per house
        if any(len(house.npcs) < 2 for house in self.houses):
            return False

        # Check if Truffle is in a mushroom biome
        truffle_house = next(
            (house for house in self.houses if "truffle" in house.npcs), None
        )
        if truffle_house and truffle_house.biome != "mushroom":
            return False

        # Check if each NPC is assigned exactly once
        all_npcs = [npc for house in self.houses for npc in house.npcs]
        if len(all_npcs) != len(set(all_npcs)):
            return False

        # Check if we have only one house per biome
        biomes = [house.biome for house in self.houses]
        if len(biomes) != len(set(biomes)):
            return False

        return True

    def total_score(
        self, exaggerate_factor: float = 1.0, use_average: bool = True
    ) -> float:
        """Calculate the happiness score for the housing arrangement.

        Args:
            exaggerate_factor: Factor to exaggerate preferences (1.0 = game values)
            use_average: If True, use average NPC happiness per house; if False, use total
        """
        if not self.is_valid():
            return 0.0

        return sum(
            house.score(self.npc_data, exaggerate_factor, use_average)
            for house in self.houses
        )


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


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Optimize NPC housing in Terraria")
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
        default=0.9995,
        help="Cooling rate for simulated annealing (0.9-0.9999)",
    )
    parser.add_argument(
        "--restarts",
        type=int,
        default=1,
        help="Number of times to restart the optimization with different initial solutions",
    )
    parser.add_argument(
        "--exaggerate",
        type=float,
        default=1.0,
        help="Factor to exaggerate NPC preferences (1.0 = game values, higher values create stronger preferences)",
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
    return parser.parse_args()


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


def score_npc(
    npc: str, house: House, npc_data: dict, exaggerate_factor: float = 1.0
) -> float:
    """Calculate happiness score for a single NPC in a house.

    Args:
        npc: The NPC to calculate score for
        house: The house the NPC is in
        npc_data: Dictionary containing NPC preference data
        exaggerate_factor: Factor to exaggerate preferences (1.0 = game values)
    """
    score = 1.0

    # Crowding penalty/bonus
    crowding = len(house.npcs) - 1
    if crowding < 3:
        # Exaggerate the crowding bonus slightly
        bonus = 1.0 + ((1.05 - 1.0) * exaggerate_factor)
        score *= bonus
    elif crowding > 3:
        # Exaggerate the crowding penalty
        penalty = 1.0 - ((1.0 - 0.95) * exaggerate_factor)
        score *= penalty ** (crowding - 3)

    # Biome preference - now with enhanced importance
    location = house.biome
    biome_score = npc_data[npc]["biome"].get(location, 0)

    # Check if this NPC has a strong biome preference elsewhere
    has_favorite_biome = False
    favorite_biome = None
    for biome, preference in npc_data[npc]["biome"].items():
        if preference == 2:  # NPC loves a specific biome
            has_favorite_biome = True
            favorite_biome = biome
            break

    # Apply exaggerated preference multipliers with additional weight for biomes
    biome_importance = 1.2  # Additional multiplier for biome preferences

    if biome_score == 2:  # Loves this biome
        bonus = 1.0 + ((1.14 - 1.0) * exaggerate_factor * biome_importance)
        score *= bonus
    elif biome_score == 1:  # Likes this biome
        bonus = 1.0 + ((1.06 - 1.0) * exaggerate_factor * biome_importance)
        score *= bonus
    elif biome_score == -1:  # Dislikes this biome
        penalty = 1.0 - ((1.0 - 0.94) * exaggerate_factor * biome_importance)
        score *= penalty
    elif biome_score == -2:  # Hates this biome
        penalty = 1.0 - ((1.0 - 0.89) * exaggerate_factor * biome_importance)
        score *= penalty
    elif biome_score == 0 and has_favorite_biome:
        # If NPC has a favorite biome but is not in it, apply a small penalty
        # This helps push NPCs toward their optimal biomes
        score *= 1.0 - (0.03 * exaggerate_factor)

    # Neighbor preferences
    for neighbour in house.npcs:
        if neighbour == npc:
            continue
        neighbour_score = npc_data[npc]["npc"].get(neighbour, 0)

        # Apply exaggerated preference multipliers for neighbors
        if neighbour_score == 2:  # Loves this neighbor
            bonus = 1.0 + ((1.14 - 1.0) * exaggerate_factor)
            score *= bonus
        elif neighbour_score == 1:  # Likes this neighbor
            bonus = 1.0 + ((1.06 - 1.0) * exaggerate_factor)
            score *= bonus
        elif neighbour_score == -1:  # Dislikes this neighbor
            penalty = 1.0 - ((1.0 - 0.94) * exaggerate_factor)
            score *= penalty
        elif neighbour_score == -2:  # Hates this neighbor
            penalty = 1.0 - ((1.0 - 0.89) * exaggerate_factor)
            score *= penalty

    return score


def optimize_housing(
    npc_data: dict,
    available_biomes: List[str],
    max_iterations: int = 10000,
    calamity: bool = False,
    initial_temperature: float = 2.0,
    cooling_rate: float = 0.9995,
    exaggerate_factor: float = 1.0,
    move_probability: float = 0.3,
    reheat_cycles: int = 3,  # Number of temperature resets during optimization
) -> Housing:
    """Find optimal NPC housing arrangement using a local search algorithm."""
    all_npcs = list(npc_data.keys())
    num_houses = len(available_biomes)

    def create_initial_solution() -> Housing:
        # Create initial housing with random assignments
        # Make sure Truffle is in mushroom biome
        houses = []
        remaining_npcs = all_npcs.copy()
        remaining_biomes = available_biomes.copy()

        # First, place Truffle in mushroom biome if it exists
        # Also add a random additional NPC to ensure minimum 2 NPCs per house
        if "truffle" in remaining_npcs and "mushroom" in remaining_biomes:
            mushroom_npcs = ["truffle"]
            remaining_npcs.remove("truffle")

            # Add a second NPC to the mushroom biome
            if remaining_npcs:
                additional_npc = random.choice(remaining_npcs)
                mushroom_npcs.append(additional_npc)
                remaining_npcs.remove(additional_npc)

            mushroom_house = House(biome="mushroom", npcs=mushroom_npcs)
            houses.append(mushroom_house)
            remaining_biomes.remove("mushroom")

        if calamity and "sea_king" in remaining_npcs and "sulphur" in remaining_biomes:
            sulphur_npcs = ["sea_king"]
            remaining_npcs.remove("sea_king")

            # Add a second NPC to the sulphur biome
            if remaining_npcs:
                additional_npc = random.choice(remaining_npcs)
                sulphur_npcs.append(additional_npc)
                remaining_npcs.remove(additional_npc)

            sulphur_house = House(biome="sulphur", npcs=sulphur_npcs)
            houses.append(sulphur_house)
            remaining_biomes.remove("sulphur")

        # Randomly distribute remaining NPCs
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

        return Housing(houses, npc_data)

    def get_neighbor_solution(current: Housing) -> Housing:
        """Generate a neighboring solution by either swapping or moving NPCs between houses."""
        new_housing = deepcopy(current)

        # Randomly select two different houses
        house1, house2 = random.sample(new_housing.houses, 2)

        # Choose between swap and move based on move_probability
        if random.random() < move_probability:
            # Perform a move operation
            return perform_move_operation(new_housing, house1, house2)
        else:
            # Perform a swap operation
            return perform_swap_operation(new_housing, house1, house2)

    def perform_swap_operation(
        housing: Housing, house1: House, house2: House
    ) -> Housing:
        """Swap NPCs between two houses without changing house sizes."""
        # Don't move Truffle from mushroom biome
        # Also don't move NPCs if it would leave a house with fewer than 2 NPCs
        valid_npcs1 = [
            npc for npc in house1.npcs if npc != "truffle" and len(house1.npcs) > 2
        ]
        valid_npcs2 = [
            npc for npc in house2.npcs if npc != "truffle" and len(house2.npcs) > 2
        ]

        # If either house has exactly 2 NPCs, we can only swap, not remove
        if len(house1.npcs) == 2:
            valid_npcs1 = [npc for npc in house1.npcs if npc != "truffle"]
            # We must swap in this case
            if not valid_npcs1:
                return housing

        if len(house2.npcs) == 2:
            valid_npcs2 = [npc for npc in house2.npcs if npc != "truffle"]
            # We must swap in this case
            if not valid_npcs2:
                return housing

        if not valid_npcs1 or not valid_npcs2:
            return housing

        # Swap random NPCs
        npc1 = random.choice(valid_npcs1)
        npc2 = random.choice(valid_npcs2)

        house1.npcs[house1.npcs.index(npc1)] = npc2
        house2.npcs[house2.npcs.index(npc2)] = npc1

        return housing

    def perform_move_operation(
        housing: Housing, house1: House, house2: House
    ) -> Housing:
        """Move an NPC from one house to another, potentially changing house sizes."""
        # Identify source house (with more NPCs) and destination house
        if len(house1.npcs) > len(house2.npcs):
            source_house = house1
            dest_house = house2
        else:
            source_house = house2
            dest_house = house1

        # Check if source house can afford to lose an NPC (must have more than 2)
        if len(source_house.npcs) <= 2:
            return housing  # Can't move, would make source house too small

        # Check if destination house is getting too crowded (game mechanics penalize overcrowding)
        # The game happiness formula has penalties for more than 4 NPCs in a house
        max_recommended_npcs = 4
        if len(dest_house.npcs) >= max_recommended_npcs:
            # Still allow the move sometimes, but with lower probability as house gets larger
            overcrowding = len(dest_house.npcs) - max_recommended_npcs + 1
            if random.random() < (
                0.3 / overcrowding
            ):  # Probability decreases with more NPCs
                pass  # Allow the move despite overcrowding
            else:
                return housing  # Too crowded, avoid this move

        # Find valid NPCs that can be moved (not Truffle from mushroom)
        valid_npcs = [
            npc
            for npc in source_house.npcs
            if not (npc == "truffle" and source_house.biome == "mushroom")
        ]

        if not valid_npcs:
            return housing  # No valid NPCs to move

        # Choose a random NPC to move
        npc_to_move = random.choice(valid_npcs)

        # Before moving, check if this NPC has strong preferences that would be violated
        # This helps guide the optimization toward more sensible moves
        if (
            housing.npc_data[npc_to_move]["biome"].get(source_house.biome, 0) > 0
            and housing.npc_data[npc_to_move]["biome"].get(dest_house.biome, 0) < 0
        ):
            # NPC likes current biome and dislikes destination biome
            # Allow with low probability (still explore the space, but prefer good moves)
            if random.random() > 0.2:  # 80% chance to reject a clearly bad biome move
                return housing

        # Move the NPC from source to destination
        source_house.npcs.remove(npc_to_move)
        dest_house.npcs.append(npc_to_move)

        return housing

    # Initialize - ensure we have a valid initial solution
    current_solution = create_initial_solution()

    # Keep generating solutions until we get a valid one
    attempts = 0
    while not current_solution.is_valid() and attempts < 10:
        current_solution = create_initial_solution()
        attempts += 1

    if not current_solution.is_valid():
        raise ValueError(
            "Unable to generate a valid initial solution. Check constraints."
        )

    best_solution = current_solution
    # Use average NPC happiness per house for optimization
    best_score = current_solution.total_score(exaggerate_factor, use_average=True)

    # Local search with simulated annealing
    temperature = initial_temperature
    cooling_rate = cooling_rate

    # Setup for reheat cycles
    iterations_per_cycle = max_iterations // reheat_cycles
    cycles_without_improvement = 0

    # For more aggressive exploration
    slow_cooling_rate = cooling_rate  # Original cooling rate
    fast_cooling_rate = cooling_rate**0.5  # Faster cooling when making progress

    # For progress reporting
    report_interval = max(
        1, max_iterations // 20
    )  # Report about 20 times during the run
    progress_count = 0
    improvements_count = 0
    last_report_time = time.time()
    last_improvement_time = time.time()

    print(
        f"\nStarting optimization with {max_iterations} iterations ({reheat_cycles} heating cycles)..."
    )

    for i in range(max_iterations):
        # Check if it's time for a temperature reset (reheat)
        if i > 0 and i % iterations_per_cycle == 0:
            old_temp = temperature
            # Reheat with a gradually decreasing intensity
            cycle = i // iterations_per_cycle
            temperature = initial_temperature * (0.8**cycle)

            print(
                f"\n--- Reheating at iteration {i}: {old_temp:.6f} -> {temperature:.6f} ---"
            )

            # If no improvements in a while, try a more drastic change
            if (
                time.time() - last_improvement_time > 30
            ):  # 30 seconds without improvement
                print(
                    "No recent improvements, attempting a more drastic rearrangement..."
                )
                # Create a new solution but keep the best NPCs together
                temp_solution = create_initial_solution()
                if temp_solution.is_valid():
                    # 20% chance to use the new solution anyway
                    if random.random() < 0.2:
                        current_solution = temp_solution
                    else:
                        # Otherwise, just shuffle some houses around in current solution
                        random.shuffle(current_solution.houses)

        neighbor = get_neighbor_solution(current_solution)
        if not neighbor.is_valid():
            continue

        neighbor_score = neighbor.total_score(exaggerate_factor, use_average=True)
        current_score = current_solution.total_score(
            exaggerate_factor, use_average=True
        )

        # Adaptively adjust cooling rate based on progress
        # Use slower cooling when making progress, faster otherwise
        if improvements_count > 0 and (i % 100) == 0:
            cooling_rate = slow_cooling_rate
        else:
            cooling_rate = fast_cooling_rate

        # Accept if better, or with probability based on temperature
        if neighbor_score > current_score or random.random() < temperature:
            current_solution = neighbor
            current_score = neighbor_score
            progress_count += 1

            if current_score > best_score:
                best_solution = deepcopy(current_solution)
                best_score = current_score
                improvements_count += 1
                last_improvement_time = time.time()

                # When we find improvements, use the slower cooling rate
                cooling_rate = slow_cooling_rate

        temperature *= cooling_rate

        # Progress reporting
        if (i + 1) % report_interval == 0:
            elapsed = time.time() - last_report_time
            completion = (i + 1) / max_iterations * 100
            print(
                f"Progress: {completion:.1f}% complete. Current temperature: {temperature:.6f}"
            )
            print(
                f"Best score so far: {best_score:.2f}, Moves accepted: {progress_count}, Improvements: {improvements_count}"
            )
            print(f"Time for last {report_interval} iterations: {elapsed:.2f}s")
            last_report_time = time.time()
            # Reset counters for this interval
            progress_count = 0
            improvements_count = 0

    return best_solution


def main():
    # Load NPC data
    npc_data = load_vanilla_npcs()
    if not npc_data:
        return
    args = parse_args()
    if args.calamity:
        load_calamity_npcs(npc_data)

    # Available biomes (excluding mushroom, which is handled specially)
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
    print("Starting NPC optimization with the following settings:")
    print(f"Number of NPCs: {len(npc_data)}")
    print(f"Available biomes: {', '.join(available_biomes)}")
    print(f"Calamity mod: {'Enabled' if args.calamity else 'Disabled'}")
    print(f"Iterations per run: {args.iterations}")
    print(f"Number of restarts: {args.restarts}")
    print(f"Initial temperature: {args.temperature}")
    print(f"Cooling rate: {args.cooling_rate}")
    print(f"Preference exaggeration factor: {args.exaggerate}")
    print(f"Move operation probability: {args.move_prob}")
    print(f"Reheat cycles: {args.reheat_cycles}")

    # Run optimization with multiple restarts
    try:
        best_housing = None
        best_score_overall = 0.0

        for restart in range(args.restarts):
            print(f"\nStarting optimization run {restart+1}/{args.restarts}")
            current_housing = optimize_housing(
                npc_data,
                available_biomes,
                args.iterations,
                args.calamity,
                args.temperature,
                args.cooling_rate,
                args.exaggerate,
                args.move_prob,
                args.reheat_cycles,
            )

            current_score = current_housing.total_score(args.exaggerate)
            print(f"Run {restart+1} completed with score: {current_score:.2f}")

            if best_housing is None or current_score > best_score_overall:
                best_housing = current_housing
                best_score_overall = current_score
                print(f"New best solution found with score {best_score_overall:.2f}")

        print("\nAll optimization runs completed.")
        print(f"Best score found: {best_score_overall:.2f}")

        # Verify the final solution is valid
        if best_housing and not best_housing.is_valid():
            print("\nWARNING: Final solution doesn't meet all constraints!")

            # Print what constraints are violated
            if any(len(house.npcs) < 2 for house in best_housing.houses):
                print("- Some houses have fewer than 2 NPCs")
                for house in best_housing.houses:
                    if len(house.npcs) < 2:
                        print(
                            f"  - {house.biome} has only {len(house.npcs)} NPCs: {', '.join(house.npcs)}"
                        )
    except ValueError as e:
        print(f"Error during optimization: {e}")
        return

    # Print results
    if not best_housing:
        print("\nNo valid solution found. Try adjusting parameters or constraints.")
        return

    print("\nOptimal NPC Housing Arrangement:")
    print("-" * 40)
    # For final output, use un-exaggerated scores to show actual game values
    total_score = 0
    exaggerated_total = 0

    for house in best_housing.houses:
        print(f"\nBiome: {house.biome.upper()}")
        print("NPCs:")

        # Calculate both raw and exaggerated scores for comparison
        house_score = house.score(npc_data, 1.0)  # Raw game score
        house_score_exaggerated = house.score(
            npc_data, args.exaggerate
        )  # Exaggerated score used for optimization

        total_score += house_score
        exaggerated_total += house_score_exaggerated

        for npc in house.npcs:
            npc_score = score_npc(npc, house, npc_data, 1.0)  # Raw game score
            exaggerated_score = score_npc(
                npc, house, npc_data, args.exaggerate
            )  # Exaggerated score
            print(f"  - {npc.replace('_', ' ').title()}: {npc_score:.2f}")

        print(f"House Total: {house_score:.2f}")

    print("\n" + "=" * 40)
    print(f"Total Happiness Score: {total_score:.2f}")

    # Show the exaggerated score used for optimization
    if args.exaggerate != 1.0:
        print(f"Exaggerated Score (used for optimization): {exaggerated_total:.2f}")


if __name__ == "__main__":
    main()
