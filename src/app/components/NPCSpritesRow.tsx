"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTooltip } from "../hooks/useTooltip";
import { NPC, NpcJson } from "../lib/NPCClass";
import NPCTooltip from "./NPCTooltip";

interface NPCSpritesRowProps {
    npcData: NpcJson;
    placedNPCs: string[]; // Array of already placed NPCs
    onDragStart: (npc: string, e: React.DragEvent<HTMLDivElement>) => void;
    npcs: Map<string, NPC>;
}

export default function NPCSpritesRow({ npcData, placedNPCs, onDragStart, npcs }: NPCSpritesRowProps) {
    // Tooltip functionality from our custom hook
    const { hoveredItem: hoveredNPC, popupPosition, isDragging, handleMouseEnter, handleMouseLeave } = useTooltip();

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isSticky, setIsSticky] = useState(false);

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

    // Track container width for when the component becomes sticky
    const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

    // Add scroll event listener to track when the component should become sticky
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            const shouldBeSticky = containerRect.top <= 0;

            if (shouldBeSticky !== isSticky) {
                setIsSticky(shouldBeSticky);

                // If becoming sticky, save the container width
                if (shouldBeSticky && !isSticky) {
                    setContainerWidth(containerRef.current.offsetWidth);
                }
            }
        };

        // Also handle resize events to update the width when window size changes
        const handleResize = () => {
            if (containerRef.current && isSticky) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };

        window.addEventListener("scroll", handleScroll);
        window.addEventListener("resize", handleResize);
        handleScroll(); // Initial check

        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleResize);
        };
    }, [isSticky]);

    return (
        <div ref={containerRef} className="mb-6">
            <div
                className={`${
                    isSticky
                        ? "fixed top-0 left-0 right-0 bg-slate-800 z-50 shadow-lg px-3 sm:px-6 py-4 transition-all duration-300 border-b border-slate-700"
                        : ""
                }`}
                style={isSticky ? { maxWidth: "100%", margin: "0 auto" } : undefined}
            >
                <h2
                    className={`text-xl font-bold mb-2 ${
                        isSticky ? "text-yellow-300" : "text-white"
                    } transition-colors duration-300`}
                >
                    Available NPCs{" "}
                    {isSticky && <span className="text-sm font-normal text-slate-300">(scroll to view all)</span>}
                </h2>
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
                            .filter((npc) => !placedNPCs.includes(npc)) // Filter out already placed NPCs
                            .map((npc) => (
                                <div
                                    key={npc}
                                    className="relative flex-shrink-0"
                                    onMouseEnter={(e) => handleMouseEnter(npc, e)}
                                    onMouseLeave={handleMouseLeave}
                                    draggable
                                    onDragStart={(e) => {
                                        handleMouseLeave(); // Hide any tooltips
                                        onDragStart(npc, e);
                                    }}
                                >
                                    <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center text-center border-2 border-slate-600 hover:border-blue-400 cursor-grab overflow-hidden">
                                        <Image
                                            width={48}
                                            height={48}
                                            src={`/sprites/${npc}.webp`}
                                            alt={npc}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* Use the shared NPCTooltip component */}
                <NPCTooltip npc={hoveredNPC} isDragging={isDragging} popupPosition={popupPosition} npcs={npcs} />
            </div>
            {/* Add a placeholder when the row is sticky to maintain layout */}
            {isSticky && <div className="h-[120px]"></div>}
        </div>
    );
}
