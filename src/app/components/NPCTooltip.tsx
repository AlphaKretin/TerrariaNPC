"use client";

interface NPCTooltipProps {
    npc: string | null;
    isDragging: boolean;
    popupPosition: {
        x: number;
        y: number;
        position: "above" | "below";
        arrowX: number; // X position where arrow should point
    };
    formatNpcName: (name: string) => string;
    getLovedBiome: (npc: string) => string;
    getHatedBiome: (npc: string) => string;
    getLovedNpcs: (npc: string) => string[];
    getLikedNpcs: (npc: string) => string[];
    getDislikedNpcs: (npc: string) => string[];
    getHatedNpcs: (npc: string) => string[];
}

export default function NPCTooltip({
    npc,
    isDragging,
    popupPosition,
    formatNpcName,
    getLovedBiome,
    getHatedBiome,
    getLovedNpcs,
    getLikedNpcs,
    getDislikedNpcs,
    getHatedNpcs,
}: NPCTooltipProps) {
    if (!npc || isDragging) return null;

    // Helper function to check if an NPC relationship list is empty
    const hasRelationships = (npc: string): boolean => {
        return (
            getLovedNpcs(npc).length > 0 ||
            getLikedNpcs(npc).length > 0 ||
            getDislikedNpcs(npc).length > 0 ||
            getHatedNpcs(npc).length > 0
        );
    };

    return (
        <div
            className="fixed bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg z-50"
            style={{
                left: `${popupPosition.x}px`,
                top: `${popupPosition.y}px`,
                transform: popupPosition.position === "above" ? "translate(-50%, -100%)" : "translate(-50%, 20px)",
                minWidth: "220px",
                maxWidth: "300px",
                pointerEvents: "none", // This ensures the tooltip doesn't interfere with mouse events
            }}
        >
            {/* Arrow indicator based on position - positioned relative to actual element center */}
            <div
                className={`absolute w-0 h-0 border-solid border-transparent ${
                    popupPosition.position === "above"
                        ? "border-t-slate-600 bottom-[-8px] border-l-8 border-r-8 border-t-8"
                        : "border-b-slate-600 top-[-8px] border-l-8 border-r-8 border-b-8"
                }`}
                style={{
                    left: `calc(50% + ${popupPosition.arrowX - popupPosition.x}px)`,
                    transform: "translateX(-50%)",
                }}
            ></div>
            <div
                className={`absolute w-0 h-0 border-solid border-transparent ${
                    popupPosition.position === "above"
                        ? "border-t-slate-800 bottom-[-6px] border-l-6 border-r-6 border-t-6"
                        : "border-b-slate-800 top-[-6px] border-l-6 border-r-6 border-b-6"
                }`}
                style={{
                    left: `calc(50% + ${popupPosition.arrowX - popupPosition.x}px)`,
                    transform: "translateX(-50%)",
                }}
            ></div>

            <div className="text-center mb-2 font-bold text-white">{formatNpcName(npc)}</div>
            <div className="gap-2 text-sm">
                <div className="mb-2">
                    <div className="font-semibold mb-1">Biome Preferences:</div>
                    <p>
                        <span className="text-green-300">Likes:</span> {getLovedBiome(npc)}
                    </p>
                    <p>
                        <span className="text-orange-400">Dislikes:</span> {getHatedBiome(npc)}
                    </p>
                </div>

                {hasRelationships(npc) && (
                    <div>
                        <div className="border-t border-slate-600 my-2"></div>
                        <div className="font-semibold mb-1">NPC Relationships:</div>
                        {getLovedNpcs(npc).length > 0 && (
                            <p>
                                <span className="text-green-500">Loves:</span> {getLovedNpcs(npc).join(", ")}
                            </p>
                        )}

                        {getLikedNpcs(npc).length > 0 && (
                            <p>
                                <span className="text-green-300">Likes:</span> {getLikedNpcs(npc).join(", ")}
                            </p>
                        )}

                        {getDislikedNpcs(npc).length > 0 && (
                            <p>
                                <span className="text-orange-400">Dislikes:</span> {getDislikedNpcs(npc).join(", ")}
                            </p>
                        )}

                        {getHatedNpcs(npc).length > 0 && (
                            <p>
                                <span className="text-red-400">Hates:</span> {getHatedNpcs(npc).join(", ")}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
