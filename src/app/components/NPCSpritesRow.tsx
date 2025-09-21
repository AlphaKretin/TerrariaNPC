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
    hatedBiome: string;
    neutralBiomes: string[];
    lovedNpcs: string[];
    likedNpcs: string[];
    dislikedNpcs: string[];
    hatedNpcs: string[];
}

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
    const [hoveredNPC, setHoveredNPC] = useState<string | null>(null);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0, position: "above" as "above" | "below" });
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Function to determine tooltip position accounting for page scroll
    const calculateTooltipPosition = (targetElement: Element) => {
        // Get element rectangle relative to viewport
        const rect = targetElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        // Calculate horizontal position (centered on element)
        let x = rect.left + rect.width / 2;

        // Keep horizontal position within viewport bounds
        const minX = 150; // Half of maxWidth (300px)
        const maxX = viewportWidth - 150;
        x = Math.max(minX, Math.min(x, maxX));

        // Calculate vertical position - start with the assumption we'll place it above
        let position: "above" | "below" = "above";
        let y = rect.top; // Position at the top of the element

        // If there's not enough space above (need ~200px), position below
        if (rect.top < 220) {
            position = "below";
            y = rect.bottom; // Position at the bottom of the element
        }

        return { x, y, position };
    };

    const handleMouseEnter = (npc: string, e: React.MouseEvent) => {
        setHoveredNPC(npc);

        // Calculate tooltip position from the event target
        const newPosition = calculateTooltipPosition(e.currentTarget);
        setPopupPosition(newPosition);
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

    // Helper function to check if an NPC relationship list is empty
    const hasRelationships = (npc: string): boolean => {
        return (
            getLovedNpcs(npc).length > 0 ||
            getLikedNpcs(npc).length > 0 ||
            getDislikedNpcs(npc).length > 0 ||
            getHatedNpcs(npc).length > 0
        );
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

    // Track currently hovered NPC element for recalculation purposes
    const hoveredElementRef = useRef<Element | null>(null);

    // Adjust tooltip position on window resize or scroll
    useEffect(() => {
        // Skip if no tooltip is shown
        if (!hoveredNPC || !hoveredElementRef.current) return;

        const handleResize = () => {
            // When window resizes, just hide the tooltip for simplicity
            setHoveredNPC(null);
        };

        const handleScroll = () => {
            // When page scrolls, either recalculate position or hide tooltip
            if (hoveredElementRef.current) {
                // Recalculate position based on current element position
                const newPosition = calculateTooltipPosition(hoveredElementRef.current);
                setPopupPosition(newPosition);
            } else {
                // If we can't find the element, hide the tooltip
                setHoveredNPC(null);
            }
        };

        window.addEventListener("resize", handleResize);
        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("scroll", handleScroll);
        };
    }, [hoveredNPC]);

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
                                onMouseEnter={(e) => {
                                    // Store the reference to the hovered element
                                    hoveredElementRef.current = e.currentTarget;
                                    handleMouseEnter(npc, e);
                                }}
                                onMouseLeave={() => {
                                    hoveredElementRef.current = null;
                                    handleMouseLeave();
                                }}
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
                    className="fixed bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg z-50"
                    style={{
                        left: `${popupPosition.x}px`,
                        top: `${popupPosition.y}px`,
                        transform:
                            popupPosition.position === "above" ? "translate(-50%, -100%)" : "translate(-50%, 10px)",
                        minWidth: "220px",
                        maxWidth: "300px",
                    }}
                >
                    {/* Arrow indicator based on position */}
                    <div
                        className={`absolute left-1/2 w-0 h-0 border-solid border-transparent ${
                            popupPosition.position === "above"
                                ? "border-t-slate-600 bottom-[-8px] border-l-8 border-r-8 border-t-8"
                                : "border-b-slate-600 top-[-8px] border-l-8 border-r-8 border-b-8"
                        }`}
                        style={{ transform: "translateX(-50%)" }}
                    ></div>
                    <div
                        className={`absolute left-1/2 w-0 h-0 border-solid border-transparent ${
                            popupPosition.position === "above"
                                ? "border-t-slate-800 bottom-[-6px] border-l-6 border-r-6 border-t-6"
                                : "border-b-slate-800 top-[-6px] border-l-6 border-r-6 border-b-6"
                        }`}
                        style={{ transform: "translateX(-50%)" }}
                    ></div>

                    <div className="text-center mb-2 font-bold text-white">{formatNpcName(hoveredNPC)}</div>
                    <div className="gap-2 text-sm">
                        <div className="mb-2">
                            <div className="font-semibold mb-1">Biome Preferences:</div>
                            <p>
                                <span className="text-green-300">Likes:</span> {getLovedBiome(hoveredNPC)}
                            </p>
                            <p>
                                <span className="text-orange-400">Dislikes:</span> {getHatedBiome(hoveredNPC)}
                            </p>
                        </div>

                        {hasRelationships(hoveredNPC) && (
                            <div>
                                <div className="border-t border-slate-600 my-2"></div>
                                <div className="font-semibold mb-1">NPC Relationships:</div>
                                {getLovedNpcs(hoveredNPC).length > 0 && (
                                    <p>
                                        <span className="text-green-500">Loves:</span>{" "}
                                        {getLovedNpcs(hoveredNPC).join(", ")}
                                    </p>
                                )}

                                {getLikedNpcs(hoveredNPC).length > 0 && (
                                    <p>
                                        <span className="text-green-300">Likes:</span>{" "}
                                        {getLikedNpcs(hoveredNPC).join(", ")}
                                    </p>
                                )}

                                {getDislikedNpcs(hoveredNPC).length > 0 && (
                                    <p>
                                        <span className="text-orange-400">Dislikes:</span>{" "}
                                        {getDislikedNpcs(hoveredNPC).join(", ")}
                                    </p>
                                )}

                                {getHatedNpcs(hoveredNPC).length > 0 && (
                                    <p>
                                        <span className="text-red-400">Hates:</span>{" "}
                                        {getHatedNpcs(hoveredNPC).join(", ")}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
