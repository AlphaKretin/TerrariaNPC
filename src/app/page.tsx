"use client";

import { useEffect, useState } from "react";
import DroppableHouse from "./components/DroppableHouse";
import NPCSpritesRow from "./components/NPCSpritesRow";

// Define types for the JSON data structure - this will be used directly without transformation
type NpcData = {
    [npcKey: string]: {
        npc: {
            [relatedNpc: string]: number;
        };
        biome: {
            [biomeName: string]: number;
        };
    };
};

// Define NPC happiness info type
interface NpcHappinessInfo {
    npc: string;
    happiness: number;
}

// Define the House type for better TypeScript support
interface House {
    id: number;
    biome: string;
    happiness: number; // Average happiness of all NPCs in the house
    npcHappiness: NpcHappinessInfo[]; // Individual happiness for each NPC
}

export default function TerrariaHappinessCalculator() {
    const [placements, setPlacements] = useState<House[]>([]);
    const [totalHappiness, setTotalHappiness] = useState(0);
    const [selectedNPC, setSelectedNPC] = useState("");
    const [selectedBiome, setSelectedBiome] = useState("Forest");
    const [npcData, setNpcData] = useState<NpcData>({});
    const [biomes, setBiomes] = useState<string[]>([]); // Store dynamically extracted biomes
    const [isLoading, setIsLoading] = useState(true);
    const [nextId, setNextId] = useState(0); // To track the next available ID for new houses
    const [draggedNPC, setDraggedNPC] = useState<string | null>(null);

    // Load NPC data when component mounts
    useEffect(() => {
        loadNpcData();
    }, []);

    // Initialize houses after NPC data is loaded
    useEffect(() => {
        if (Object.keys(npcData).length > 0) {
            initializeHouses(10); // Start with 10 houses by default
            setIsLoading(false);
        }
    }, [npcData]);

    // Update total happiness whenever placements change
    useEffect(() => {
        if (isLoading || placements.length === 0) return;

        // Calculate total happiness from all houses
        const total = placements.reduce((sum, house) => {
            return house.npcHappiness.length > 0 ? sum + house.happiness : sum;
        }, 0);

        // Update total happiness
        setTotalHappiness(parseFloat((total || 0).toFixed(2)));
    }, [placements, isLoading]);

    // Recalculate happiness whenever placements change
    useEffect(() => {
        // Skip during initial load or when there are no placements
        if (isLoading || placements.length === 0) return;

        // Calculate happiness for all placements
        const updatedPlacements = placements.map((house) => {
            // Calculate happiness only if there are NPCs in the house
            if (house.npcHappiness && house.npcHappiness.length > 0) {
                // Calculate individual NPC happiness
                const updatedNpcHappiness: NpcHappinessInfo[] = house.npcHappiness.map((npcInfo) => {
                    const happiness = calculateSingleNpcHappiness(npcInfo.npc, house, placements);
                    return {
                        npc: npcInfo.npc,
                        happiness,
                    };
                });

                // Calculate overall house happiness (average)
                const totalHappiness = updatedNpcHappiness.reduce((sum, info) => sum + info.happiness, 0);
                const averageHappiness = parseFloat((totalHappiness / updatedNpcHappiness.length).toFixed(2));

                return {
                    ...house,
                    happiness: averageHappiness,
                    npcHappiness: updatedNpcHappiness,
                };
            }
            return house;
        });

        // Only update if happiness values have changed
        const hasChanges = updatedPlacements.some((house, i) => house.happiness !== placements[i].happiness);

        if (hasChanges) {
            setPlacements(updatedPlacements);
        }
    }, [placements, npcData]);

    // Function to load NPC data from JSON file
    const loadNpcData = async () => {
        try {
            const response = await fetch("/vanilla.json");
            if (!response.ok) {
                throw new Error(`Failed to load NPC data: ${response.status}`);
            }
            const data: NpcData = await response.json();

            // Extract all biomes from the NPC data
            const extractedBiomes = new Set<string>();

            // Iterate through all NPCs and their biome preferences
            Object.values(data).forEach((npcPrefs) => {
                if (npcPrefs.biome) {
                    // Add each biome key to the set (this automatically handles duplicates)
                    Object.keys(npcPrefs.biome).forEach((biomeName) => {
                        extractedBiomes.add(biomeName);
                    });
                }
            });

            // Convert to array, sort alphabetically, and capitalize first letter of each biome
            let biomeList = Array.from(extractedBiomes)
                .sort()
                .map((biomeName) => biomeName.charAt(0).toUpperCase() + biomeName.slice(1));

            // Handle Forest biome - make it the first in the list if it exists
            // or add it if it doesn't exist
            const forestIndex = biomeList.findIndex((biome) => biome === "Forest");
            if (forestIndex !== -1) {
                // Forest exists, move it to the first position
                biomeList = ["Forest", ...biomeList.slice(0, forestIndex), ...biomeList.slice(forestIndex + 1)];
            }

            // Store the biomes list
            setBiomes(biomeList);

            // If we had a default biome that doesn't exist in the data, update it
            if (biomeList.length > 0 && !biomeList.includes(selectedBiome)) {
                setSelectedBiome(biomeList[0]);
            }

            // Store the raw JSON data directly without transformation
            setNpcData(data);
        } catch (error) {
            console.error("Error loading NPC data:", error);
            // Fallback to empty data if there's an error
            setIsLoading(false);
        }
    };

    // Helper functions to work with the raw JSON format

    // Format snake_case to Title Case (e.g., "arms_dealer" -> "Arms Dealer")
    const formatNpcName = (npcKey: string): string => {
        return npcKey
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };

    // Convert a display name (Title Case) back to snake_case key
    const toSnakeCase = (name: string): string => {
        return name.toLowerCase().replace(/\s+/g, "_");
    };

    // Get biome preference type based on value (1 = loved, -1 = hated)
    const getBiomePreferenceType = (value: number): string => {
        if (value === 1) return "loves";
        if (value === -1) return "hates";
        return "neutral";
    };

    // Get NPC preference type based on value (1/2 = liked, -1/-2 = disliked)
    const getNpcPreferenceType = (value: number): string => {
        if (value === 2) return "loves";
        if (value === 1) return "likes";
        if (value === -1) return "dislikes";
        if (value === -2) return "hates";
        return "neutral";
    };

    // Get all NPCs that an NPC likes (positive value in JSON)
    const getLikedNpcs = (npc: string): string[] => {
        if (!npcData[npc]?.npc) return [];

        return Object.entries(npcData[npc].npc)
            .filter(([_, value]) => value > 0)
            .map(([relatedNpc, _]) => formatNpcName(relatedNpc));
    };

    // Get all NPCs that an NPC dislikes (negative value in JSON)
    const getDislikedNpcs = (npc: string): string[] => {
        if (!npcData[npc]?.npc) return [];

        return Object.entries(npcData[npc].npc)
            .filter(([_, value]) => value < 0)
            .map(([relatedNpc, _]) => formatNpcName(relatedNpc));
    };

    // Get the loved biome (value 1 in JSON)
    const getLovedBiome = (npc: string): string => {
        if (!npcData[npc]?.biome) return "Forest"; // Default

        const lovedBiomes = Object.entries(npcData[npc].biome)
            .filter(([_, value]) => value === 1)
            .map(([biome, _]) => biome.charAt(0).toUpperCase() + biome.slice(1));

        return lovedBiomes[0] || "Forest"; // Default to Forest if not found
    };

    // Get the hated biome (value -1 in JSON)
    const getHatedBiome = (npc: string): string => {
        if (!npcData[npc]?.biome) return "Desert"; // Default

        const hatedBiomes = Object.entries(npcData[npc].biome)
            .filter(([_, value]) => value === -1)
            .map(([biome, _]) => biome.charAt(0).toUpperCase() + biome.slice(1));

        return hatedBiomes[0] || "Desert"; // Default to Desert if not found
    };

    // For UI display purposes - get other preferred biomes
    const getLikedBiome = (npc: string): string => {
        const loved = getLovedBiome(npc);
        return loved === "Forest" ? "Ocean" : "Forest"; // Simple logic for liked biome
    };

    // For UI display purposes - get other disliked biomes
    const getDislikedBiome = (npc: string): string => {
        const hated = getHatedBiome(npc);
        return hated === "Desert" ? "Snow" : "Desert"; // Simple logic for disliked biome
    };

    // Find the first unused biome from the biomes list
    const getNextUnusedBiome = (existingHouses: House[]) => {
        if (biomes.length === 0) return "Forest";

        // Count how many houses use each biome
        const biomeCounts = new Map<string, number>();

        // Initialize all biomes with zero count
        biomes.forEach((biome) => biomeCounts.set(biome, 0));

        // Count existing placements
        existingHouses.forEach((house) => {
            if (house.biome) {
                const currentCount = biomeCounts.get(house.biome) || 0;
                biomeCounts.set(house.biome, currentCount + 1);
            }
        });

        // Find the biome with the lowest count
        let leastUsedBiome = biomes[0];
        let lowestCount = biomeCounts.get(biomes[0]) || 0;

        for (const biome of biomes) {
            const count = biomeCounts.get(biome) || 0;
            if (count < lowestCount) {
                lowestCount = count;
                leastUsedBiome = biome;
            }
        }

        return leastUsedBiome;
    };

    const initializeHouses = (count: number) => {
        const initialHouses: House[] = [];

        // Limit the number of houses to the number of biomes if we have any biomes
        const actualCount = biomes.length > 0 ? Math.min(count, biomes.length) : count;

        for (let i = 0; i < actualCount; i++) {
            // For each new house, get the next unused biome
            const nextBiome = getNextUnusedBiome(initialHouses);

            initialHouses.push({
                id: i,
                biome: nextBiome,
                happiness: 1.0,
                npcHappiness: [],
            });
        }
        setPlacements(initialHouses);
        setNextId(count); // Initialize nextId to be the next available ID
    };

    // Add a new house
    const addHouse = () => {
        // Update placements with functional update pattern
        setPlacements((prevPlacements) => {
            // Get the next unused biome based on current house distribution
            const nextBiome = getNextUnusedBiome(prevPlacements);

            // Create new house with the current nextId and the next unused biome
            const newHouse: House = {
                id: nextId,
                biome: nextBiome,
                happiness: 1.0,
                npcHappiness: [],
            };

            const newPlacements = [...prevPlacements, newHouse];
            return newPlacements;
        });

        // Increment the nextId for the next house
        setNextId((prevId) => prevId + 1);
    };

    // Remove a house
    const removeHouse = (houseId: number) => {
        // Use functional update to ensure we're working with the latest state
        setPlacements((prevPlacements) => {
            // Check if house exists before attempting to remove
            const houseToRemove = prevPlacements.find((house) => house.id === houseId);
            if (!houseToRemove) return prevPlacements;

            // Filter out the house to remove
            const filteredPlacements = prevPlacements.filter((house) => house.id !== houseId);

            // The happiness will be recalculated in useEffect
            return filteredPlacements;
        });
    };

    // Calculate happiness for a single NPC
    const calculateSingleNpcHappiness = (npc: string, house: House, currentPlacements = placements) => {
        // Get the snake_case version of the NPC name to use as key in npcData
        const npcKey = toSnakeCase(npc);
        if (!npc || !npcData[npcKey]) return 1.0;

        let happiness = 1.0;

        // Biome happiness modifiers
        // Check if the biome exists in the NPC's biome preferences
        const lowercaseBiome = house.biome.toLowerCase();
        if (npcData[npcKey].biome && npcData[npcKey].biome[lowercaseBiome] !== undefined) {
            const biomeValue = npcData[npcKey].biome[lowercaseBiome];

            // Apply happiness modifications based on biome value
            if (biomeValue === 1) {
                // Loved biome (value = 1)
                happiness *= 0.94;
            } else if (biomeValue === -1) {
                // Hated biome (value = -1)
                happiness *= 1.12;
            }
        } else {
            // For biomes not explicitly listed in preferences,
            // Check if it's a liked or disliked biome based on our helper functions
            if (house.biome === getLikedBiome(npcKey)) happiness *= 0.96;
            else if (house.biome === getDislikedBiome(npcKey)) happiness *= 1.06;
        }

        // Special case for Princess
        if (npc === "Princess") {
            // The Princess likes all biomes except hated ones
            if (house.biome !== "None") happiness *= 0.94;
        }

        // Happiness modifiers based on other NPCs in the same house (internal neighbors)
        const otherNpcsInHouse = house.npcHappiness.filter((info) => info.npc !== npc).map((info) => info.npc);
        otherNpcsInHouse.forEach((otherNpc) => {
            const otherNpcKey = toSnakeCase(otherNpc);

            // Special case for Princess who likes all NPCs
            if (npc === "Princess") {
                happiness *= 0.94;
                return;
            }

            // Check relationship with other NPCs in the same house
            if (npcData[npcKey]?.npc && npcData[npcKey].npc[otherNpcKey] !== undefined) {
                const relationValue = npcData[npcKey].npc[otherNpcKey];

                if (relationValue > 0) {
                    // Positive relationship (likes/loves) - stronger effect for same house
                    happiness *= 0.9; // Stronger effect than external neighbors
                } else if (relationValue < 0) {
                    // Negative relationship (dislikes/hates) - stronger effect for same house
                    happiness *= 1.1; // Stronger effect than external neighbors
                }
            }
        });

        // External neighbor happiness modifiers (NPCs in nearby houses)
        const neighbors = findNeighbors(house.id, currentPlacements);
        neighbors.forEach((neighbor) => {
            // Loop through each NPC in the neighbor house
            neighbor.npcHappiness.forEach((neighborInfo) => {
                const neighborKey = toSnakeCase(neighborInfo.npc);

                // Special case for Princess who likes all NPCs
                if (npc === "Princess") {
                    happiness *= 0.94;
                    return;
                }

                // Check if the neighbor NPC is in the preferences
                if (npcData[npcKey]?.npc && npcData[npcKey].npc[neighborKey] !== undefined) {
                    const relationValue = npcData[npcKey].npc[neighborKey];

                    if (relationValue > 0) {
                        // Positive relationship (likes/loves)
                        happiness *= 0.94;
                    } else if (relationValue < 0) {
                        // Negative relationship (dislikes/hates)
                        happiness *= 1.06;
                    }
                }
            });
        });

        // Add crowding penalty if applicable
        const crowdingPenalty = calculateCrowdingPenalty(house.id, currentPlacements);
        happiness *= 1 + crowdingPenalty * 0.06;

        return parseFloat(happiness.toFixed(2));
    };

    // Calculate overall happiness for a house with multiple NPCs
    const calculateHappiness = (house: House, currentPlacements: House[]) => {
        if (house.npcHappiness.length === 0) return 1.0;

        // Calculate happiness for each NPC in the house
        const happinessValues = house.npcHappiness.map((npcInfo) =>
            calculateSingleNpcHappiness(npcInfo.npc, house, currentPlacements)
        );

        // Calculate the average happiness of all NPCs in the house
        const totalHappiness = happinessValues.reduce((sum: number, h: number) => sum + h, 0);
        return parseFloat((totalHappiness / happinessValues.length).toFixed(2));
    };

    // Find neighbors for a house
    const findNeighbors = (houseId: number, currentPlacements: House[]): House[] => {
        // In Terraria, NPCs within 25 tiles are neighbors
        // For simplicity, we'll consider houses with adjacent positions in the sorted array as neighbors

        // Sort placements by ID to ensure consistent neighbor calculations
        const sortedPlacements = [...currentPlacements].sort((a, b) => a.id - b.id);

        // Find the index of the current house in the sorted placements array
        const currentHouseIndex = sortedPlacements.findIndex((house) => house.id === houseId);
        if (currentHouseIndex === -1) return [];

        const neighbors: House[] = [];

        // Check left neighbor (if exists)
        if (currentHouseIndex > 0) {
            const leftNeighbor = sortedPlacements[currentHouseIndex - 1];
            if (leftNeighbor.npcHappiness && leftNeighbor.npcHappiness.length > 0) {
                neighbors.push(leftNeighbor);
            }
        }

        // Check right neighbor (if exists)
        if (currentHouseIndex < sortedPlacements.length - 1) {
            const rightNeighbor = sortedPlacements[currentHouseIndex + 1];
            if (rightNeighbor.npcHappiness && rightNeighbor.npcHappiness.length > 0) {
                neighbors.push(rightNeighbor);
            }
        }

        return neighbors;
    };

    // Calculate crowding penalty based on number of NPCs within 120 tiles
    // Simplified for this simulation
    const calculateCrowdingPenalty = (houseId: number, currentPlacements: House[]): number => {
        const crowdingRange = 3; // Simplified - count 3 houses in each direction

        // Sort placements by ID to ensure consistent crowding calculations
        const sortedPlacements = [...currentPlacements].sort((a, b) => a.id - b.id);

        // Find the index of the current house in the sorted placements array
        const currentHouseIndex = sortedPlacements.findIndex((house) => house.id === houseId);
        if (currentHouseIndex === -1) return 0;

        const minIndex = Math.max(0, currentHouseIndex - crowdingRange);
        const maxIndex = Math.min(sortedPlacements.length - 1, currentHouseIndex + crowdingRange);

        let npcCount = 0;
        for (let i = minIndex; i <= maxIndex; i++) {
            if (
                sortedPlacements[i] &&
                sortedPlacements[i].npcHappiness.length > 0 &&
                sortedPlacements[i].id !== houseId
            ) {
                // Count all NPCs in nearby houses
                npcCount += sortedPlacements[i].npcHappiness.length;
            }
        }

        return npcCount > 3 ? npcCount - 3 : 0; // Penalty starts after 3 NPCs
    };

    // Calculate happiness for all placements without modifying state
    // This function can be used for calculations but doesn't update state
    const calculateAllHappiness = (currentPlacements: House[]) => {
        return currentPlacements.map((house: House) => {
            if (house.npcHappiness.length > 0) {
                const happiness = calculateHappiness(house, currentPlacements);
                return { ...house, happiness };
            }
            return house;
        });
    };

    // Handle NPC drag start
    const handleNpcDragStart = (npc: string, e: React.DragEvent<HTMLDivElement>) => {
        setDraggedNPC(npc);
        // Store the NPC name in the drag event
        e.dataTransfer.setData("npc", npc);
    };

    // Handle NPC placement
    const placeNPC = (houseId: number, npc: string | null = null) => {
        const npcToPlace = npc || selectedNPC;
        if (!npcToPlace) return;

        // Use functional update to ensure we're working with the latest state
        setPlacements((prevPlacements: House[]) => {
            // Check if house exists before attempting to place NPC
            const houseToUpdate = prevPlacements.find((house: House) => house.id === houseId);
            if (!houseToUpdate) return prevPlacements;

            // Check if the NPC is already placed in any house
            const existingHouseIndex = prevPlacements.findIndex((house: House) =>
                house.npcHappiness.some((info) => info.npc === npcToPlace)
            );

            // Create a copy of the placements to work with
            let newPlacements = [...prevPlacements];

            // If NPC is already placed in another house, remove it from there first
            if (existingHouseIndex !== -1 && prevPlacements[existingHouseIndex].id !== houseId) {
                newPlacements = newPlacements.map((house: House, index: number) => {
                    if (index === existingHouseIndex) {
                        // Remove NPC from the previous house's happiness array
                        const updatedNpcHappiness = house.npcHappiness.filter((info) => info.npc !== npcToPlace);

                        return {
                            ...house,
                            npcHappiness: updatedNpcHappiness,
                        };
                    }
                    return house;
                });
            }

            // Now add the NPC to the target house if it's not already there
            return newPlacements.map((house: House) => {
                if (house.id === houseId && !house.npcHappiness.some((info) => info.npc === npcToPlace)) {
                    // Add NPC to the house with default happiness
                    return {
                        ...house,
                        npcHappiness: [...house.npcHappiness, { npc: npcToPlace, happiness: 1.0 }],
                    };
                }
                return house;
            });
        });
    };

    // Handle biome change
    const changeBiome = (houseId: number, biome: string) => {
        // Use functional update to ensure we're working with the latest state
        setPlacements((prevPlacements: House[]) => {
            // Check if house exists before attempting to change biome
            const houseToUpdate = prevPlacements.find((house: House) => house.id === houseId);
            if (!houseToUpdate) return prevPlacements;

            // Update the placement with the new biome
            return prevPlacements.map((house: House) => {
                if (house.id === houseId) {
                    return { ...house, biome };
                }
                return house;
            });
        });
    };

    // Remove NPC from house
    const removeNPC = (houseId: number, npcToRemove?: string) => {
        // Use functional update to ensure we're working with the latest state
        setPlacements((prevPlacements: House[]) => {
            // Check if house exists before attempting to remove NPC
            const houseToUpdate = prevPlacements.find((house: House) => house.id === houseId);
            if (!houseToUpdate) return prevPlacements;

            // If a specific NPC is specified, remove just that one
            if (npcToRemove) {
                return prevPlacements.map((house: House) => {
                    if (house.id === houseId) {
                        // Update the npcHappiness array to remove the NPC
                        const updatedNpcHappiness = house.npcHappiness.filter((info) => info.npc !== npcToRemove);

                        return {
                            ...house,
                            npcHappiness: updatedNpcHappiness,
                            // If all NPCs were removed, reset happiness
                            happiness: updatedNpcHappiness.length > 0 ? house.happiness : 1.0,
                        };
                    }
                    return house;
                });
            }
            // Otherwise, remove all NPCs from the house
            else {
                return prevPlacements.map((house: House) => {
                    if (house.id === houseId) {
                        return {
                            ...house,
                            npcHappiness: [],
                            happiness: 1.0,
                        };
                    }
                    return house;
                });
            }
        });
    };

    // Calculate pricing modifier based on happiness
    const calculatePriceModifier = (happiness: number) => {
        // Terraria formula: 0.75 + happiness * 0.25
        return (0.75 + happiness * 0.25).toFixed(2);
    };

    // Get happiness description
    const getHappinessDescription = (happiness: number) => {
        if (happiness <= 0.85) return "Loves it here";
        if (happiness <= 0.95) return "Likes it here";
        if (happiness <= 1.05) return "Content";
        if (happiness <= 1.15) return "Dislikes it here";
        return "Hates it here";
    };

    // Get happiness color
    const getHappinessColor = (happiness: number) => {
        if (happiness <= 0.85) return "text-green-500";
        if (happiness <= 0.95) return "text-green-400";
        if (happiness <= 1.05) return "text-yellow-400";
        if (happiness <= 1.15) return "text-orange-400";
        return "text-red-500";
    };

    // Show loading state while NPC data is being loaded
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 text-white p-6 flex items-center justify-center">
                <p className="text-2xl">Loading NPC data...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-bold text-yellow-300 mb-2">Terraria NPC Happiness Simulator</h1>
                <p className="text-slate-300">Optimize your town layout for the best prices and Pylons!</p>
            </header>

            <div className="mb-8 bg-slate-800 p-6 rounded-lg shadow-lg">
                {/* NPC Sprites Row - Draggable */}
                <NPCSpritesRow
                    npcData={npcData}
                    placedNPCs={placements.flatMap((house) => house.npcHappiness.map((info) => info.npc))}
                    onDragStart={(npc, e) => handleNpcDragStart(npc, e)}
                    formatNpcName={formatNpcName}
                    getLovedBiome={(npc) => getLovedBiome(toSnakeCase(npc))}
                    getLikedBiome={(npc) => getLikedBiome(toSnakeCase(npc))}
                    getDislikedBiome={(npc) => getDislikedBiome(toSnakeCase(npc))}
                    getHatedBiome={(npc) => getHatedBiome(toSnakeCase(npc))}
                    getLikedNpcs={(npc) => getLikedNpcs(toSnakeCase(npc))}
                    getDislikedNpcs={(npc) => getDislikedNpcs(toSnakeCase(npc))}
                />

                <div className="flex justify-between items-center mt-6">
                    <button onClick={addHouse} className="bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded">
                        Add New House
                    </button>

                    <div className="text-center p-3 bg-slate-700 rounded-lg">
                        <div className="text-sm text-slate-300">Total Happiness:</div>
                        <div className="text-2xl font-bold">{totalHappiness.toFixed(2)}</div>
                        <div className="text-sm text-slate-400">(Lower is better)</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...placements]
                    .sort((a, b) => a.id - b.id)
                    .map((house) => (
                        <DroppableHouse
                            key={house.id}
                            house={house}
                            biomes={biomes}
                            onChangeNPC={(houseId, npc) => placeNPC(houseId, npc)}
                            onChangeBiome={(houseId, biome) => changeBiome(houseId, biome)}
                            onRemoveHouse={(houseId) => removeHouse(houseId)}
                            onRemoveNPC={(houseId, npc) => removeNPC(houseId, npc)}
                            calculatePriceModifier={calculatePriceModifier}
                            getHappinessDescription={getHappinessDescription}
                            getHappinessColor={getHappinessColor}
                        />
                    ))}
            </div>

            <footer className="mt-12 text-center text-slate-400 text-sm">
                <p>Terraria NPC Happiness Simulator - Based on Terraria 1.4.x mechanics</p>
                <p className="mt-1">
                    Note: This is a simplified version of the game mechanics. For exact calculations, refer to the
                    Terraria Wiki.
                </p>
            </footer>
        </div>
    );
}
