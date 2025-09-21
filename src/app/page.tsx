"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DataSelector, { DataSource } from "./components/DataSelector";
import DroppableHouse, { House } from "./components/DroppableHouse";
import NPCSpritesRow from "./components/NPCSpritesRow";
import SaveLoad from "./components/SaveLoad";
import { NPC, NpcJson } from "./lib/NPCClass";
import { toTitleCase } from "./utils/formatting";

// Define NPC price info type
interface NpcPriceInfo {
    npc: string;
    buyPrice: number;
    sellPrice: number;
    factors: string[]; // Add happiness factors
}

export default function TerrariaHappinessCalculator() {
    const [placements, setPlacements] = useState<House[]>([]);
    const [averageHappiness, setAverageHappiness] = useState(0);
    const [npcData, setNpcData] = useState<NpcJson>({});
    const [biomes, setBiomes] = useState<string[]>([]); // Store dynamically extracted biomes
    const [isLoading, setIsLoading] = useState(true);
    const [nextId, setNextId] = useState(0); // To track the next available ID for new houses
    const [npcs, setNpcs] = useState<Map<string, NPC>>(new Map());
    const [dataSources, setDataSources] = useState<DataSource[]>([
        { id: "calamity", name: "Calamity", enabled: false },
        { id: "fargos", name: "Fargo's", enabled: false },
    ]);
    const initialSetupDone = useRef(false);

    // Handle data source changes
    const handleDataSourceChange = useCallback((sources: DataSource[]) => {
        // Set the new data sources state directly - since we're now fully controlling the component
        setDataSources(sources);
    }, []);

    // Load NPC data when component mounts or when data sources change
    useEffect(() => {
        // Function to load NPC data from JSON files
        const loadNpcData = async () => {
            try {
                setIsLoading(true);

                // Always load vanilla data as the base
                const vanillaResponse = await fetch("/data/vanilla.json");
                if (!vanillaResponse.ok) {
                    throw new Error(`Failed to load vanilla NPC data: ${vanillaResponse.status}`);
                }
                let mergedData: NpcJson = await vanillaResponse.json();

                // Store which NPCs come from which data sources
                // This helps us know which NPCs to remove when a source is disabled
                const npcSourceMap = new Map<string, string>();

                // Mark all vanilla NPCs
                Object.keys(mergedData).forEach((npc) => {
                    npcSourceMap.set(npc, "vanilla");
                });

                // Load additional data files based on selected sources
                for (const source of dataSources) {
                    if (source.enabled) {
                        try {
                            const response = await fetch(`/data/${source.id}.json`);
                            if (response.ok) {
                                const additionalData: NpcJson = await response.json();
                                // Mark all NPCs from this source
                                Object.keys(additionalData).forEach((npc) => {
                                    npcSourceMap.set(npc, source.id);
                                });
                                // Merge the additional data with the base data
                                mergedData = { ...mergedData, ...additionalData };
                            } else {
                                console.error(`Failed to load ${source.name} data: ${response.status}`);
                            }
                        } catch (err) {
                            console.error(`Error loading ${source.name} data:`, err);
                        }
                    }
                }

                // Extract all biomes from the merged NPC data
                const extractedBiomes = new Set<string>();

                // Iterate through all NPCs and their biome preferences
                Object.values(mergedData).forEach((npcPrefs) => {
                    if (npcPrefs.biome) {
                        // Add each biome key to the set (this automatically handles duplicates)
                        Object.keys(npcPrefs.biome).forEach((biomeName) => {
                            extractedBiomes.add(biomeName);
                        });
                    }
                });

                // Extract biomes from JSON (already lowercase from json files)
                let biomeList = Array.from(extractedBiomes).sort();

                // Handle forest biome - make it the first in the list if it exists
                const forestIndex = biomeList.findIndex((biome) => biome === "forest");
                if (forestIndex !== -1) {
                    // Forest exists, move it to the first position
                    biomeList = ["forest", ...biomeList.slice(0, forestIndex), ...biomeList.slice(forestIndex + 1)];
                }

                // Store the biomes list
                setBiomes(biomeList);

                // Sort the data alphabetically by keys
                const sortedData = Object.fromEntries(
                    Object.entries(mergedData).sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                );

                // Store the sorted JSON data for reference
                setNpcData(sortedData);

                // Create NPC objects from the sorted JSON data
                const npcObjects = new Map<string, NPC>();
                Object.entries(sortedData).forEach(([npcKey, npcData]) => {
                    npcObjects.set(npcKey, new NPC(npcKey, npcData));
                });

                // Update houses to remove any NPCs that are no longer available
                // due to disabling a data source
                setPlacements((prevPlacements) => {
                    // Preserve the original layout structure
                    return prevPlacements.map((house) => {
                        // Filter out NPCs that no longer exist in the npcObjects map
                        const updatedNpcPrices = house.npcPrices.filter((npcPrice) => npcObjects.has(npcPrice.npc));

                        // Preserve biome and all other house properties
                        return {
                            ...house,
                            npcPrices: updatedNpcPrices,
                        };
                    });
                });

                setNpcs(npcObjects);
                setIsLoading(false);
            } catch (error) {
                console.error("Error loading NPC data:", error);
                // Fallback to empty data if there's an error
                setIsLoading(false);
            }
        };
        loadNpcData();
    }, [dataSources]); // Only run when dataSources change

    // Find the first unused biome from the biomes list
    const getNextUnusedBiome = useCallback(
        (existingHouses: House[]) => {
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
        },
        [biomes]
    );

    // Initialize houses after NPC data is loaded, but only if we haven't done it before
    useEffect(() => {
        // Skip if we've already initialized houses or if we don't have NPC data yet
        if (initialSetupDone.current || Object.keys(npcData).length === 0) {
            if (Object.keys(npcData).length > 0) {
                setIsLoading(false);
            }
            return;
        }

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

            // Only set the placements if we haven't already set them before
            if (placements.length === 0) {
                setPlacements(initialHouses);
                setNextId(count); // Initialize nextId to be the next available ID
                initialSetupDone.current = true;
            }
        };

        // Initialize with 10 houses by default
        initializeHouses(10);
        setIsLoading(false);
    }, [npcData, biomes, getNextUnusedBiome, placements.length]);

    // Update total sell price modifier whenever placements change
    useEffect(() => {
        if (isLoading || placements.length === 0) return;

        // Calculate total sell price from all houses
        const total = placements.reduce((sum, house) => {
            return house.npcPrices.length > 0 ? sum + house.sellPrice : sum;
        }, 0);

        const fullPlacements = placements.filter((p) => p.npcPrices.length > 0);

        const avg = total / fullPlacements.length;

        // Update total happiness (now representing total sell price modifier)
        setAverageHappiness(parseFloat((avg || 0).toFixed(2)));
    }, [placements, isLoading]);

    // Recalculate prices whenever placements change
    useEffect(() => {
        // Check if a house is eligible for a pylon
        const checkPylonEligibility = (house: House): boolean => {
            // Must have at least 2 NPCs
            if (house.npcPrices.length < 2) return false;

            const shopNpcs = house.npcPrices.filter((info) => {
                const npc = npcs.get(info.npc);
                return npc && npc.hasShop();
            });

            if (shopNpcs.length < 1) return false;

            // At least one NPC with a shop must have a buy price of 0.9 or lower
            const hasDiscountedShopNpc = shopNpcs.some((info) => {
                const npc = npcs.get(info.npc);
                return npc && npc.hasShop() && info.buyPrice <= 0.9;
            });

            return hasDiscountedShopNpc;
        };

        // Calculate prices for a single NPC
        const calculateSingleNpcPrices = (npc: string, house: House) => {
            const npcObject = npcs.get(npc);
            let buyPrice = 1.0;
            let sellPrice = 1.0;
            const factors: string[] = [];
            if (!npc || !npcObject) return { buyPrice, sellPrice, factors };

            const biomeScore = npcObject.getValueForBiome(house.biome);

            // Use the shared toTitleCase function for consistent display
            const displayBiome = toTitleCase(house.biome);

            if (biomeScore === 2) {
                buyPrice *= 0.88;
                sellPrice *= 1.14;
                factors.push(`Loves ${displayBiome} biome`);
            }
            if (biomeScore === 1) {
                buyPrice *= 0.94;
                sellPrice *= 1.06;
                factors.push(`Likes ${displayBiome} biome`);
            }
            if (biomeScore === -1) {
                buyPrice *= 1.06;
                sellPrice *= 0.94;
                factors.push(`Dislikes ${displayBiome} biome`);
            }
            if (biomeScore === -2) {
                buyPrice *= 1.12;
                sellPrice *= 0.89;
                factors.push(`Hates ${displayBiome} biome`);
            }
            const neighbours = house.npcPrices.map((p) => p.npc).filter((neighbourNpc) => neighbourNpc !== npc);

            // Calculate overcrowding/solitude score
            if (neighbours.length < 2) {
                // special case: princess HATES being lonely
                if (npc === "princess") {
                    buyPrice = 1.5;
                    sellPrice = 0.5;
                    factors.push(`Princess solitude penalty: Only ${neighbours.length} neighbours`);
                    return { buyPrice, sellPrice, factors };
                }
            }
            if (neighbours.length < 3) {
                buyPrice *= 0.95;
                sellPrice *= 1.05;
                factors.push(`Solitude bonus: Only ${neighbours.length} neighbours`);
            }
            if (neighbours.length > 3) {
                for (let i = 3; i < neighbours.length; i++) {
                    buyPrice *= 1.05;
                    sellPrice *= 0.95;
                }
                factors.push(`Overcrowding penalty: ${neighbours.length} neighbours`);
            }

            // special case: princess loves any NPC, but only up to 3 neighbours
            if (npc === "princess") {
                const loves = Math.min(neighbours.length, 3);
                for (let i = 0; i < loves; i++) {
                    const neighbour = neighbours[i];
                    buyPrice *= 0.88;
                    sellPrice *= 1.14;
                    factors.push(`Princess loves up to 3 neighbours (${npcs.get(neighbour)?.name || neighbour})`);
                }
            }

            for (const neighbour of neighbours) {
                const neighbourScore = npcObject.getValueForNpc(neighbour);
                if (neighbourScore === 2) {
                    buyPrice *= 0.88;
                    sellPrice *= 1.14;
                    factors.push(`Loves ${npcs.get(neighbour)?.name || neighbour}`);
                }
                if (neighbourScore === 1) {
                    buyPrice *= 0.94;
                    sellPrice *= 1.06;
                    factors.push(`Likes ${npcs.get(neighbour)?.name || neighbour}`);
                }
                if (neighbourScore === -1) {
                    buyPrice *= 1.06;
                    sellPrice *= 0.94;
                    factors.push(`Dislikes ${npcs.get(neighbour)?.name || neighbour}`);
                }
                if (neighbourScore === -2) {
                    buyPrice *= 1.12;
                    sellPrice *= 0.89;
                    factors.push(`Hates ${npcs.get(neighbour)?.name || neighbour}`);
                }
            }

            return { buyPrice, sellPrice, factors };
        };
        // Skip during initial load or when there are no placements
        if (isLoading || placements.length === 0) return;

        // Calculate prices for all placements
        const updatedPlacements = placements.map((house) => {
            // Calculate prices only if there are NPCs in the house
            if (house.npcPrices && house.npcPrices.length > 0) {
                // Calculate individual NPC prices
                const updatedNpcPrices: NpcPriceInfo[] = house.npcPrices.map((npcInfo) => {
                    const { buyPrice, sellPrice, factors } = calculateSingleNpcPrices(npcInfo.npc, house);
                    return {
                        npc: npcInfo.npc,
                        buyPrice,
                        sellPrice,
                        factors,
                    };
                });

                // Calculate overall house prices (average)
                const totalBuyPrice = updatedNpcPrices.reduce((sum, info) => sum + info.buyPrice, 0);
                const totalSellPrice = updatedNpcPrices.reduce((sum, info) => sum + info.sellPrice, 0);
                const averageBuyPrice = parseFloat((totalBuyPrice / updatedNpcPrices.length).toFixed(2));
                const averageSellPrice = parseFloat((totalSellPrice / updatedNpcPrices.length).toFixed(2));

                // Check if house is eligible for a pylon
                const updatedHouse = {
                    ...house,
                    buyPrice: averageBuyPrice,
                    sellPrice: averageSellPrice,
                    npcPrices: updatedNpcPrices,
                };

                // Check pylon eligibility
                updatedHouse.isPylonEligible = checkPylonEligibility(updatedHouse);

                return updatedHouse;
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
    }, [placements, npcData, isLoading, npcs]);

    // Add a new house
    const addHouse = () => {
        // Update placements with functional update pattern
        setPlacements((prevPlacements) => {
            // Get the next unused biome based on current house distribution
            const nextBiome = getNextUnusedBiome(prevPlacements);

            // Create new house with the current nextId and the next unused biome (always lowercase)
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

    // Handle NPC drag start
    const handleNpcDragStart = (npc: string, e: React.DragEvent<HTMLDivElement>) => {
        // Store the NPC name in the drag event
        e.dataTransfer.setData("npc", npc);
    };

    // Handle NPC placement
    const placeNPC = (houseId: number, npc: string | null = null) => {
        const npcToPlace = npc;
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
                        npcPrices: [
                            ...house.npcPrices,
                            { npc: npcToPlace, buyPrice: 1.0, sellPrice: 1.0, factors: [] },
                        ],
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

    // Load saved layout
    const handleLoadPlacements = (savedPlacements: House[]) => {
        // Ensure the nextId is updated to be higher than any house ID in the loaded layout
        const highestId = savedPlacements.reduce((maxId, house) => Math.max(maxId, house.id), -1);

        // Set the nextId to be one higher than the highest ID in the loaded layout
        setNextId(highestId + 1);

        // Set the placements to the saved layout
        setPlacements(savedPlacements);
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
                <DataSelector dataSources={dataSources} onDataSourceChange={handleDataSourceChange} className="mb-4" />
            </div>

            <div className="mb-8 bg-slate-800 p-6 rounded-lg shadow-lg">
                {/* NPC Sprites Row - Draggable */}
                <NPCSpritesRow
                    npcData={npcData}
                    placedNPCs={placements.flatMap((house) => house.npcPrices.map((info) => info.npc))}
                    onDragStart={(npc, e) => handleNpcDragStart(npc, e)}
                    npcs={npcs}
                />

                <div className="flex flex-wrap justify-between items-center mt-6 gap-4">
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={addHouse}
                            className="bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded"
                        >
                            Add New House
                        </button>

                        <div className="text-center p-3 bg-slate-700 rounded-lg">
                            <div className="text-sm text-slate-300">Average Happiness:</div>
                            <div className="text-2xl font-bold">{averageHappiness.toFixed(2)}</div>
                        </div>
                    </div>

                    <div className="w-full md:w-auto">
                        <SaveLoad placements={placements} onLoadPlacements={handleLoadPlacements} />
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
                            getPriceColor={getPriceColor}
                            npcs={npcs}
                        />
                    ))}
            </div>
        </div>
    );
}
