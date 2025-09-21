"use client";

import { useEffect, useRef, useState } from "react";
import { useTooltip } from "../hooks/useTooltip";
import NPCTooltip from "./NPCTooltip";

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

interface NPCSpritesRowProps {
    npcData: NpcData;
    placedNPCs: string[]; // Array of already placed NPCs
    onDragStart: (npc: string, e: React.DragEvent<HTMLDivElement>) => void;
    formatNpcName: (name: string) => string;
    getLovedBiome: (npc: string) => string;
    getHatedBiome: (npc: string) => string;
    getNeutralBiomes?: (npc: string) => string[]; // Made optional since we don't display it
    getLovedNpcs: (npc: string) => string[];
    getLikedNpcs: (npc: string) => string[];
    getDislikedNpcs: (npc: string) => string[];
    getHatedNpcs: (npc: string) => string[];
}

export default function NPCSpritesRow({
    npcData,
    placedNPCs,
    onDragStart,
    formatNpcName,
    getLovedBiome,
    getHatedBiome,
    getNeutralBiomes, // We'll keep this but won't use it for display
    getLovedNpcs,
    getLikedNpcs,
    getDislikedNpcs,
    getHatedNpcs,
}: NPCSpritesRowProps) {
    // Tooltip functionality from our custom hook
    const {
        hoveredItem: hoveredNPC,
        popupPosition,
        isDragging,
        setIsDragging,
        handleMouseEnter,
        handleMouseLeave,
    } = useTooltip();

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

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
                                onDragStart={(e) => {
                                    handleMouseLeave(); // Hide any tooltips
                                    onDragStart(formatNpcName(npc), e);
                                }}
                            >
                                <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center text-center border-2 border-slate-600 hover:border-blue-400 cursor-grab overflow-hidden">
                                    <img
                                        src={`/sprites/${npc}.webp`}
                                        alt={formatNpcName(npc)}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            {/* Use the shared NPCTooltip component */}
            <NPCTooltip
                npc={hoveredNPC}
                isDragging={isDragging}
                popupPosition={popupPosition}
                formatNpcName={formatNpcName}
                getLovedBiome={getLovedBiome}
                getHatedBiome={getHatedBiome}
                getLovedNpcs={getLovedNpcs}
                getLikedNpcs={getLikedNpcs}
                getDislikedNpcs={getDislikedNpcs}
                getHatedNpcs={getHatedNpcs}
            />
        </div>
    );
}
