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

// Define NPC price info type
interface NpcPriceInfo {
    npc: string;
    buyPrice: number;
    sellPrice: number;
}

// Define the House type for better TypeScript support
interface House {
    id: number;
    biome: string;
    buyPrice: number; // Average buy price of all NPCs in the house
    sellPrice: number; // Average sell price of all NPCs in the house
    npcPrices: NpcPriceInfo[]; // Individual prices for each NPC
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

    // Update total sell price modifier whenever placements change
    useEffect(() => {
        if (isLoading || placements.length === 0) return;

        // Calculate total sell price from all houses
        const total = placements.reduce((sum, house) => {
            return house.npcPrices.length > 0 ? sum + house.sellPrice : sum;
        }, 0);

        // Update total happiness (now representing total sell price modifier)
        setTotalHappiness(parseFloat((total || 0).toFixed(2)));
    }, [placements, isLoading]);

    // Recalculate prices whenever placements change
    useEffect(() => {
        // Skip during initial load or when there are no placements
        if (isLoading || placements.length === 0) return;

        // Calculate prices for all placements
        const updatedPlacements = placements.map((house) => {
            // Calculate prices only if there are NPCs in the house
            if (house.npcPrices && house.npcPrices.length > 0) {
                // Calculate individual NPC prices
                const updatedNpcPrices: NpcPriceInfo[] = house.npcPrices.map((npcInfo) => {
                    const { buyPrice, sellPrice } = calculateSingleNpcPrices(npcInfo.npc, house, placements);
                    return {
                        npc: npcInfo.npc,
                        buyPrice,
                        sellPrice,
                    };
                });

                // Calculate overall house prices (average)
                const totalBuyPrice = updatedNpcPrices.reduce((sum, info) => sum + info.buyPrice, 0);
                const totalSellPrice = updatedNpcPrices.reduce((sum, info) => sum + info.sellPrice, 0);
                const averageBuyPrice = parseFloat((totalBuyPrice / updatedNpcPrices.length).toFixed(2));
                const averageSellPrice = parseFloat((totalSellPrice / updatedNpcPrices.length).toFixed(2));

                return {
                    ...house,
                    buyPrice: averageBuyPrice,
                    sellPrice: averageSellPrice,
                    npcPrices: updatedNpcPrices,
                };
            }
            return house;
        });

        // Only update if price values have changed
        const hasChanges = updatedPlacements.some(
            (house, i) => house.buyPrice !== placements[i].buyPrice || house.sellPrice !== placements[i].sellPrice
        );

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

    // Get all NPCs that an NPC loves (value 2 in JSON)
    const getLovedNpcs = (npc: string): string[] => {
        if (!npcData[npc]?.npc) return [];

        return Object.entries(npcData[npc].npc)
            .filter(([_, value]) => value === 2)
            .map(([relatedNpc, _]) => formatNpcName(relatedNpc));
    };

    // Get all NPCs that an NPC likes (value 1 in JSON)
    const getLikedNpcs = (npc: string): string[] => {
        if (!npcData[npc]?.npc) return [];

        return Object.entries(npcData[npc].npc)
            .filter(([_, value]) => value === 1)
            .map(([relatedNpc, _]) => formatNpcName(relatedNpc));
    };

    // Get all NPCs that an NPC dislikes (value -1 in JSON)
    const getDislikedNpcs = (npc: string): string[] => {
        if (!npcData[npc]?.npc) return [];

        return Object.entries(npcData[npc].npc)
            .filter(([_, value]) => value === -1)
            .map(([relatedNpc, _]) => formatNpcName(relatedNpc));
    };

    // Get all NPCs that an NPC hates (value -2 in JSON)
    const getHatedNpcs = (npc: string): string[] => {
        if (!npcData[npc]?.npc) return [];

        return Object.entries(npcData[npc].npc)
            .filter(([_, value]) => value === -2)
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

    // Since biomes only have loved (1) and hated (-1) in the JSON data,
    // we should remove the concept of "liked" and "disliked" biomes that don't exist in the data

    // Neutral biomes - biomes that are neither loved nor hated
    const getNeutralBiomes = (npc: string): string[] => {
        if (!npcData[npc]?.biome) return ["Forest"];

        const allBiomes = biomes.map((biome) => biome);
        const lovedBiome = getLovedBiome(npc).toLowerCase();
        const hatedBiome = getHatedBiome(npc).toLowerCase();

        return allBiomes.filter((biome) => biome.toLowerCase() !== lovedBiome && biome.toLowerCase() !== hatedBiome);
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
                buyPrice: 1.0,
                sellPrice: 1.0,
                npcPrices: [],
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
                buyPrice: 1.0,
                sellPrice: 1.0,
                npcPrices: [],
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

    // Calculate prices for a single NPC
    const calculateSingleNpcPrices = (npc: string, house: House, currentPlacements = placements) => {
        // Get the snake_case version of the NPC name to use as key in npcData
        const npcKey = toSnakeCase(npc);
        if (!npc || !npcData[npcKey]) return { buyPrice: 1.0, sellPrice: 1.0 };

        let priceMultiplier = 1.0;

        // Biome price modifiers
        // Check if the biome exists in the NPC's biome preferences
        const lowercaseBiome = house.biome.toLowerCase();
        if (npcData[npcKey].biome && npcData[npcKey].biome[lowercaseBiome] !== undefined) {
            const biomeValue = npcData[npcKey].biome[lowercaseBiome];

            // Apply price modifications based on biome value
            if (biomeValue === 1) {
                // Loved biome (value = 1)
                priceMultiplier *= 0.94;
            } else if (biomeValue === -1) {
                // Hated biome (value = -1)
                priceMultiplier *= 1.12;
            }
        } else {
            // For biomes not explicitly listed in preferences,
            // They are neutral - no price modification needed
            // Let's keep a default behavior just in case
            const neutralBiomes = getNeutralBiomes(npcKey);
            if (neutralBiomes.includes(house.biome)) {
                // No change to prices for neutral biomes
            }
        }

        // Special case for Princess
        if (npc === "Princess") {
            // The Princess likes all biomes except hated ones
            if (house.biome !== "None") priceMultiplier *= 0.94;
        }

        // Price modifiers based on other NPCs in the same house (internal neighbors)
        const otherNpcsInHouse = house.npcPrices.filter((info) => info.npc !== npc).map((info) => info.npc);
        otherNpcsInHouse.forEach((otherNpc) => {
            const otherNpcKey = toSnakeCase(otherNpc);

            // Special case for Princess who likes all NPCs
            if (npc === "Princess") {
                priceMultiplier *= 0.94;
                return;
            }

            // Check relationship with other NPCs in the same house
            if (npcData[npcKey]?.npc && npcData[npcKey].npc[otherNpcKey] !== undefined) {
                const relationValue = npcData[npcKey].npc[otherNpcKey];

                if (relationValue > 0) {
                    // Positive relationship (likes/loves) - stronger effect for same house
                    priceMultiplier *= 0.9; // Stronger effect than external neighbors
                } else if (relationValue < 0) {
                    // Negative relationship (dislikes/hates) - stronger effect for same house
                    priceMultiplier *= 1.1; // Stronger effect than external neighbors
                }
            }
        });

        // External neighbor price modifiers (NPCs in nearby houses)
        const neighbors = findNeighbors(house.id, currentPlacements);
        neighbors.forEach((neighbor) => {
            // Loop through each NPC in the neighbor house
            neighbor.npcPrices.forEach((neighborInfo) => {
                const neighborKey = toSnakeCase(neighborInfo.npc);

                // Special case for Princess who likes all NPCs
                if (npc === "Princess") {
                    priceMultiplier *= 0.94;
                    return;
                }

                // Check if the neighbor NPC is in the preferences
                if (npcData[npcKey]?.npc && npcData[npcKey].npc[neighborKey] !== undefined) {
                    const relationValue = npcData[npcKey].npc[neighborKey];

                    if (relationValue > 0) {
                        // Positive relationship (likes/loves)
                        priceMultiplier *= 0.94;
                    } else if (relationValue < 0) {
                        // Negative relationship (dislikes/hates)
                        priceMultiplier *= 1.06;
                    }
                }
            });
        });

        // Add crowding penalty if applicable
        const crowdingPenalty = calculateCrowdingPenalty(house.id, currentPlacements);
        priceMultiplier *= 1 + crowdingPenalty * 0.06;

        // Calculate buy and sell prices
        // In Terraria, buy price = 1.0 + happiness * 0.5
        // Sell price = 0.75 + happiness * 0.25 (this is the opposite of the happiness factor)
        const buyPrice = parseFloat((1.0 + priceMultiplier * 0.5).toFixed(2));
        const sellPrice = parseFloat((0.75 + (2.0 - priceMultiplier) * 0.25).toFixed(2));

        return { buyPrice, sellPrice };
    };

    // Calculate overall prices for a house with multiple NPCs
    const calculatePrices = (house: House, currentPlacements: House[]) => {
        if (house.npcPrices.length === 0) return { buyPrice: 1.0, sellPrice: 1.0 };

        // Calculate prices for each NPC in the house
        const priceValues = house.npcPrices.map((npcInfo) =>
            calculateSingleNpcPrices(npcInfo.npc, house, currentPlacements)
        );

        // Calculate the average buy and sell prices of all NPCs in the house
        const totalBuyPrice = priceValues.reduce(
            (sum: number, price: { buyPrice: number; sellPrice: number }) => sum + price.buyPrice,
            0
        );
        const totalSellPrice = priceValues.reduce(
            (sum: number, price: { buyPrice: number; sellPrice: number }) => sum + price.sellPrice,
            0
        );

        const avgBuyPrice = parseFloat((totalBuyPrice / priceValues.length).toFixed(2));
        const avgSellPrice = parseFloat((totalSellPrice / priceValues.length).toFixed(2));

        return { buyPrice: avgBuyPrice, sellPrice: avgSellPrice };
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
            if (leftNeighbor.npcPrices && leftNeighbor.npcPrices.length > 0) {
                neighbors.push(leftNeighbor);
            }
        }

        // Check right neighbor (if exists)
        if (currentHouseIndex < sortedPlacements.length - 1) {
            const rightNeighbor = sortedPlacements[currentHouseIndex + 1];
            if (rightNeighbor.npcPrices && rightNeighbor.npcPrices.length > 0) {
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
            if (sortedPlacements[i] && sortedPlacements[i].npcPrices.length > 0 && sortedPlacements[i].id !== houseId) {
                // Count all NPCs in nearby houses
                npcCount += sortedPlacements[i].npcPrices.length;
            }
        }

        return npcCount > 3 ? npcCount - 3 : 0; // Penalty starts after 3 NPCs
    };

    // Calculate happiness for all placements without modifying state
    // This function can be used for calculations but doesn't update state
    const calculateAllPrices = (currentPlacements: House[]) => {
        return currentPlacements.map((house: House) => {
            if (house.npcPrices.length > 0) {
                const { buyPrice, sellPrice } = calculatePrices(house, currentPlacements);
                return { ...house, buyPrice, sellPrice };
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
                house.npcPrices.some((info) => info.npc === npcToPlace)
            );

            // Create a copy of the placements to work with
            let newPlacements = [...prevPlacements];

            // If NPC is already placed in another house, remove it from there first
            if (existingHouseIndex !== -1 && prevPlacements[existingHouseIndex].id !== houseId) {
                newPlacements = newPlacements.map((house: House, index: number) => {
                    if (index === existingHouseIndex) {
                        // Remove NPC from the previous house's prices array
                        const updatedNpcPrices = house.npcPrices.filter((info) => info.npc !== npcToPlace);

                        return {
                            ...house,
                            npcPrices: updatedNpcPrices,
                        };
                    }
                    return house;
                });
            }

            // Now add the NPC to the target house if it's not already there
            return newPlacements.map((house: House) => {
                if (house.id === houseId && !house.npcPrices.some((info) => info.npc === npcToPlace)) {
                    // Add NPC to the house with default prices
                    return {
                        ...house,
                        npcPrices: [...house.npcPrices, { npc: npcToPlace, buyPrice: 1.0, sellPrice: 1.0 }],
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
                        // Update the npcPrices array to remove the NPC
                        const updatedNpcPrices = house.npcPrices.filter((info) => info.npc !== npcToRemove);

                        return {
                            ...house,
                            npcPrices: updatedNpcPrices,
                            // If all NPCs were removed, reset prices
                            buyPrice: updatedNpcPrices.length > 0 ? house.buyPrice : 1.0,
                            sellPrice: updatedNpcPrices.length > 0 ? house.sellPrice : 1.0,
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
                            npcPrices: [],
                            buyPrice: 1.0,
                            sellPrice: 1.0,
                        };
                    }
                    return house;
                });
            }
        });
    };

    // Get price description based on sell price
    const getPriceDescription = (sellPrice: number) => {
        if (sellPrice >= 1.15) return "Loves it here";
        if (sellPrice >= 1.05) return "Likes it here";
        if (sellPrice >= 0.95) return "Content";
        if (sellPrice >= 0.85) return "Dislikes it here";
        return "Hates it here";
    };

    // Get price color based on sell price
    const getPriceColor = (sellPrice: number) => {
        if (sellPrice >= 1.15) return "text-green-500";
        if (sellPrice >= 1.05) return "text-green-400";
        if (sellPrice >= 0.95) return "text-yellow-400";
        if (sellPrice >= 0.85) return "text-orange-400";
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
                    placedNPCs={placements.flatMap((house) => house.npcPrices.map((info) => info.npc))}
                    onDragStart={(npc, e) => handleNpcDragStart(npc, e)}
                    formatNpcName={formatNpcName}
                    getLovedBiome={(npc) => getLovedBiome(toSnakeCase(npc))}
                    getHatedBiome={(npc) => getHatedBiome(toSnakeCase(npc))}
                    getNeutralBiomes={(npc) => getNeutralBiomes(toSnakeCase(npc))}
                    getLovedNpcs={(npc) => getLovedNpcs(toSnakeCase(npc))}
                    getLikedNpcs={(npc) => getLikedNpcs(toSnakeCase(npc))}
                    getDislikedNpcs={(npc) => getDislikedNpcs(toSnakeCase(npc))}
                    getHatedNpcs={(npc) => getHatedNpcs(toSnakeCase(npc))}
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
                            getPriceDescription={getPriceDescription}
                            getPriceColor={getPriceColor}
                            formatNpcName={formatNpcName}
                            getLovedBiome={(npc) => getLovedBiome(toSnakeCase(npc))}
                            getHatedBiome={(npc) => getHatedBiome(toSnakeCase(npc))}
                            getNeutralBiomes={(npc) => getNeutralBiomes(toSnakeCase(npc))}
                            getLovedNpcs={(npc) => getLovedNpcs(toSnakeCase(npc))}
                            getLikedNpcs={(npc) => getLikedNpcs(toSnakeCase(npc))}
                            getDislikedNpcs={(npc) => getDislikedNpcs(toSnakeCase(npc))}
                            getHatedNpcs={(npc) => getHatedNpcs(toSnakeCase(npc))}
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
