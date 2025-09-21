"use client";

import { useEffect, useRef, useState } from "react";

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

interface NpcPreferencesPopup {
    npc: string;
    lovedBiome: string;
    likedBiome: string;
    dislikedBiome: string;
    hatedBiome: string;
    lovedNpcs: string[];
    dislikedNpcs: string[];
}

interface NPCSpritesRowProps {
    npcData: NpcData;
    placedNPCs: string[]; // Array of already placed NPCs
    onDragStart: (npc: string, e: React.DragEvent<HTMLDivElement>) => void;
    formatNpcName: (name: string) => string;
    getLovedBiome: (npc: string) => string;
    getLikedBiome: (npc: string) => string;
    getDislikedBiome: (npc: string) => string;
    getHatedBiome: (npc: string) => string;
    getLikedNpcs: (npc: string) => string[];
    getDislikedNpcs: (npc: string) => string[];
}

export default function NPCSpritesRow({
    npcData,
    placedNPCs,
    onDragStart,
    formatNpcName,
    getLovedBiome,
    getLikedBiome,
    getDislikedBiome,
    getHatedBiome,
    getLikedNpcs,
    getDislikedNpcs,
}: NPCSpritesRowProps) {
    const [hoveredNPC, setHoveredNPC] = useState<string | null>(null);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseEnter = (npc: string, e: React.MouseEvent) => {
        setHoveredNPC(npc);

        // Calculate position for tooltip to avoid going off-screen
        const rect = e.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top - 10; // Position above the sprite

        setPopupPosition({ x, y });
    };

    const handleMouseLeave = () => {
        setHoveredNPC(null);
    };

    // For horizontal scrolling by mouse drag
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;

        setIsScrolling(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const handleMouseUp = () => {
        setIsScrolling(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isScrolling || !scrollRef.current) return;

        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    // Handle cleanup of event listeners
    useEffect(() => {
        const handleMouseUpGlobal = () => {
            setIsScrolling(false);
        };

        document.addEventListener("mouseup", handleMouseUpGlobal);

        return () => {
            document.removeEventListener("mouseup", handleMouseUpGlobal);
        };
    }, []);

    return (
        <div className="mb-6">
            <h2 className="text-xl font-bold mb-2 text-white">Available NPCs:</h2>
            <div
                ref={scrollRef}
                className="flex overflow-x-auto pb-2 cursor-grab"
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseUp}
            >
                <div className="flex space-x-2 min-w-max p-2">
                    {Object.keys(npcData)
                        .filter((npc) => !placedNPCs.includes(formatNpcName(npc))) // Filter out already placed NPCs
                        .map((npc) => (
                            <div
                                key={npc}
                                className="relative flex-shrink-0"
                                onMouseEnter={(e) => handleMouseEnter(npc, e)}
                                onMouseLeave={handleMouseLeave}
                                draggable
                                onDragStart={(e) => onDragStart(formatNpcName(npc), e)}
                            >
                                <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center text-center border-2 border-slate-600 hover:border-blue-400 cursor-grab">
                                    {formatNpcName(npc).substring(0, 3)}
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            {/* Tooltip/popup for NPC preferences */}
            {hoveredNPC && (
                <div
                    className="absolute bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg z-50 w-64"
                    style={{
                        left: `${popupPosition.x}px`,
                        top: `${popupPosition.y - 10}px`,
                        transform: "translate(-50%, -100%)",
                    }}
                >
                    <div className="text-center mb-2 font-bold text-white">{formatNpcName(hoveredNPC)}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <p>
                                <span className="text-green-400">Loves:</span> {getLovedBiome(hoveredNPC)}
                            </p>
                            <p>
                                <span className="text-green-300">Likes:</span> {getLikedBiome(hoveredNPC)}
                            </p>
                            <p>
                                <span className="text-orange-400">Dislikes:</span> {getDislikedBiome(hoveredNPC)}
                            </p>
                            <p>
                                <span className="text-red-400">Hates:</span> {getHatedBiome(hoveredNPC)}
                            </p>
                        </div>
                        <div>
                            <p>
                                <span className="text-green-400">Friends:</span>{" "}
                                {getLikedNpcs(hoveredNPC).join(", ") || "None"}
                            </p>
                            <p>
                                <span className="text-red-400">Enemies:</span>{" "}
                                {getDislikedNpcs(hoveredNPC).join(", ") || "None"}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
