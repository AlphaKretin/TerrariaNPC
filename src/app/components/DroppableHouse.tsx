"use client";

import React, { useState } from "react";

// NPC happiness information
interface NpcHappinessInfo {
    npc: string;
    happiness: number;
}

interface House {
    id: number;
    biome: string;
    happiness: number; // Average happiness of all NPCs in the house
    npcHappiness: NpcHappinessInfo[]; // Individual happiness for each NPC
}

interface DroppableHouseProps {
    house: House;
    biomes: string[];
    onChangeNPC: (houseId: number, npc: string | null) => void;
    onChangeBiome: (houseId: number, biome: string) => void;
    onRemoveHouse: (houseId: number) => void;
    onRemoveNPC: (houseId: number, npc?: string) => void; // Optional NPC parameter for removing one or all NPCs
    calculatePriceModifier: (happiness: number) => string;
    getHappinessDescription: (happiness: number) => string;
    getHappinessColor: (happiness: number) => string;
}

export default function DroppableHouse({
    house,
    biomes,
    onChangeNPC,
    onChangeBiome,
    onRemoveHouse,
    onRemoveNPC,
    calculatePriceModifier,
    getHappinessDescription,
    getHappinessColor,
}: DroppableHouseProps) {
    const [isOver, setIsOver] = useState(false);

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

    return (
        <div
            className={`p-4 rounded-lg shadow-lg border-2 transition-colors ${
                isOver
                    ? "bg-blue-800/30 border-blue-500"
                    : house.npcHappiness.length > 0
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

            {house.npcHappiness.length > 0 ? (
                <div className="bg-slate-700 p-3 rounded mb-3">
                    <div className="flex justify-between items-center mb-2">
                        <div className="font-semibold">
                            {house.npcHappiness.length} {house.npcHappiness.length === 1 ? "NPC" : "NPCs"}
                        </div>
                        {house.npcHappiness.length > 0 && (
                            <button onClick={handleClearHouse} className="text-red-400 text-xs hover:text-red-300">
                                Clear All
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3 mb-3">
                        {house.npcHappiness.map((npcInfo) => (
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
                                }}
                                onDragEnd={(e) => {
                                    // Remove opacity effect when drag ends
                                    if (e.currentTarget.classList) {
                                        e.currentTarget.classList.remove("opacity-50");
                                    }
                                }}
                            >
                                {/* NPC Header */}
                                <div className="bg-slate-700 w-full px-2 py-1 flex justify-between items-center">
                                    <span className="font-medium text-sm truncate flex-grow">{npcInfo.npc}</span>
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
                                    {/* Placeholder for NPC sprite - replace with actual image later */}
                                    <div className="w-14 h-14 bg-slate-500 rounded-md flex items-center justify-center cursor-grab hover:bg-slate-400 transition-colors">
                                        {npcInfo.npc.substring(0, 2)}
                                    </div>
                                </div>

                                {/* NPC Happiness */}
                                <div className="w-full bg-slate-700 px-2 py-1 text-center">
                                    <div className={`text-sm font-bold ${getHappinessColor(npcInfo.happiness)}`}>
                                        {npcInfo.happiness.toFixed(2)}
                                    </div>
                                    <div className="text-xs mt-1">
                                        <span className={npcInfo.happiness < 1.0 ? "text-green-400" : "text-red-400"}>
                                            {calculatePriceModifier(npcInfo.happiness)}x
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
                                <span>Average Happiness:</span>
                                <span className={`font-bold ${getHappinessColor(house.happiness)}`}>
                                    {house.happiness.toFixed(2)}
                                </span>
                            </p>
                            <p className="flex justify-between items-center">
                                <span>Average Prices:</span>
                                <span
                                    className={`font-bold ${house.happiness < 1.0 ? "text-green-400" : "text-red-400"}`}
                                >
                                    {calculatePriceModifier(house.happiness)}x
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
        </div>
    );
}
