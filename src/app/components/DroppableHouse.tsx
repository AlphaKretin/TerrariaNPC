"use client";

import Image from "next/image";
import React, { useState } from "react";
import { useTooltip } from "../hooks/useTooltip";
import { NPC } from "../lib/NPCClass";
import NPCTooltip from "./NPCTooltip";

// NPC price information
interface NpcPriceInfo {
    npc: string;
    buyPrice: number;
    sellPrice: number;
}

interface House {
    id: number;
    biome: string;
    buyPrice: number; // Average buy price of all NPCs in the house
    sellPrice: number; // Average sell price of all NPCs in the house
    npcPrices: NpcPriceInfo[]; // Individual prices for each NPC
}

interface DroppableHouseProps {
    house: House;
    biomes: string[];
    onChangeNPC: (houseId: number, npc: string | null) => void;
    onChangeBiome: (houseId: number, biome: string) => void;
    onRemoveHouse: (houseId: number) => void;
    onRemoveNPC: (houseId: number, npc?: string) => void; // Optional NPC parameter for removing one or all NPCs
    getPriceColor: (sellPrice: number) => string;
    // Collection of NPC objects
    npcs: Map<string, NPC>;
}

export default function DroppableHouse({
    house,
    biomes,
    onChangeNPC,
    onChangeBiome,
    onRemoveHouse,
    onRemoveNPC,
    getPriceColor,
    npcs,
}: DroppableHouseProps) {
    const [isOver, setIsOver] = useState(false);

    // Use the shared tooltip hook
    const {
        hoveredItem: hoveredNPC,
        popupPosition,
        isDragging,
        setIsDragging,
        handleMouseEnter: tooltipMouseEnter,
        handleMouseLeave: tooltipMouseLeave,
    } = useTooltip();

    // Handle the drag over event
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!isOver) setIsOver(true);
    };

    // Handle the drag leave event
    const handleDragLeave = () => {
        setIsOver(false);
    };

    // Handle the drop event
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(false);
        // Reset dragging state on drop
        setIsDragging(false);

        const npc = e.dataTransfer.getData("npc");
        if (npc) {
            // onChangeNPC will handle removing from previous house if necessary
            onChangeNPC(house.id, npc);
        }
    };

    // Remove a specific NPC from this house
    const handleRemoveNPC = (npc: string) => {
        onRemoveNPC(house.id, npc);
    };

    // Remove all NPCs from this house
    const handleClearHouse = () => {
        onRemoveNPC(house.id); // Call removeNPC without an NPC parameter to clear all NPCs
    };

    // Handle NPC mouse hover events using our shared hook
    const handleNpcMouseEnter = (npc: string, e: React.MouseEvent) => {
        tooltipMouseEnter(npc, e);
    };

    return (
        <div
            className={`p-4 rounded-lg shadow-lg border-2 transition-colors ${
                isOver
                    ? "bg-blue-800/30 border-blue-500"
                    : house.npcPrices.length > 0
                    ? "bg-slate-800 border-slate-600"
                    : "bg-slate-800/50 border-slate-700"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">House #{house.id + 1}</h3>
                    <button
                        onClick={() => onRemoveHouse(house.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                        title="Delete this house"
                    >
                        <span className="border border-red-400 rounded-full w-5 h-5 inline-flex items-center justify-center">
                            ×
                        </span>
                    </button>
                </div>

                <select
                    value={house.biome}
                    onChange={(e) => onChangeBiome(house.id, e.target.value)}
                    className="bg-slate-700 text-sm p-1 rounded"
                >
                    {biomes.map((biome) => (
                        <option key={biome} value={biome}>
                            {biome}
                        </option>
                    ))}
                </select>
            </div>

            {house.npcPrices.length > 0 ? (
                <div className="bg-slate-700 p-3 rounded mb-3">
                    <div className="flex justify-between items-center mb-2">
                        <div className="font-semibold">
                            {house.npcPrices.length} {house.npcPrices.length === 1 ? "NPC" : "NPCs"}
                        </div>
                        {house.npcPrices.length > 0 && (
                            <button onClick={handleClearHouse} className="text-red-400 text-xs hover:text-red-300">
                                Clear All
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3 mb-3">
                        {house.npcPrices.map((npcInfo) => (
                            <div
                                key={npcInfo.npc}
                                className="bg-slate-600 rounded-lg flex flex-col items-center w-28 overflow-hidden shadow-md hover:shadow-lg hover:border-blue-400 hover:border transition-all cursor-grab active:cursor-grabbing"
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("npc", npcInfo.npc);
                                    // Add opacity effect to show element is being dragged
                                    if (e.currentTarget.classList) {
                                        e.currentTarget.classList.add("opacity-50");
                                    }
                                    // Hide any active tooltips when dragging starts - handled by useTooltip hook
                                    setIsDragging(true);
                                }}
                                onDragEnd={(e) => {
                                    // Remove opacity effect when drag ends
                                    if (e.currentTarget.classList) {
                                        e.currentTarget.classList.remove("opacity-50");
                                    }
                                    // Explicitly reset the dragging state
                                    setIsDragging(false);
                                }}
                            >
                                {/* NPC Header */}
                                <div className="bg-slate-700 w-full px-2 py-1 flex justify-between items-center">
                                    <span className="font-medium text-sm truncate flex-grow">
                                        {npcs.get(npcInfo.npc)?.name || npcInfo.npc}
                                    </span>
                                    <button
                                        onClick={() => handleRemoveNPC(npcInfo.npc)}
                                        className="text-red-400 hover:text-red-300 ml-1 flex-shrink-0"
                                        title="Remove NPC"
                                    >
                                        ×
                                    </button>
                                </div>

                                {/* NPC Sprite */}
                                <div className="p-2 flex items-center justify-center">
                                    <div
                                        className="w-14 h-14 bg-slate-500 rounded-md flex items-center justify-center cursor-grab hover:bg-slate-400 transition-colors overflow-hidden"
                                        onMouseEnter={(e) => handleNpcMouseEnter(npcInfo.npc, e)}
                                        onMouseLeave={tooltipMouseLeave}
                                    >
                                        <Image
                                            width={24}
                                            height={42}
                                            src={`/sprites/${npcInfo.npc}.webp`}
                                            alt={npcInfo.npc}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                </div>

                                {/* NPC Prices */}
                                <div className="w-full bg-slate-700 px-2 py-1 text-center">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span>Buy:</span>
                                        <span className="font-bold text-orange-400">
                                            {npcInfo.buyPrice.toFixed(2)}x
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span>Sell:</span>
                                        <span className={`font-bold ${getPriceColor(npcInfo.sellPrice)}`}>
                                            {npcInfo.sellPrice.toFixed(2)}x
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>{" "}
                    <div className="mt-4 border-t border-slate-600 pt-3">
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="text-sm font-bold text-white">House Summary</h4>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-2">
                            <p className="flex justify-between items-center mb-1">
                                <span>Buy Prices:</span>
                                <span className="font-bold text-orange-400">{house.buyPrice.toFixed(2)}x</span>
                            </p>
                            <p className="flex justify-between items-center">
                                <span>Sell Prices:</span>
                                <span className={`font-bold ${getPriceColor(house.sellPrice)}`}>
                                    {house.sellPrice.toFixed(2)}x
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-700/50 p-8 rounded mb-3 flex items-center justify-center min-h-[120px] border-2 border-dashed border-slate-600">
                    <p className="text-slate-400 text-center">Drag and drop NPCs here</p>
                </div>
            )}

            {/* Use the shared NPCTooltip component */}
            <NPCTooltip npc={hoveredNPC} isDragging={isDragging} popupPosition={popupPosition} npcs={npcs} />
        </div>
    );
}
