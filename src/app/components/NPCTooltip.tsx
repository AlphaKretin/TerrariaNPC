"use client";

import { NPC } from "../lib/NPCClass";
import { toTitleCase } from "../utils/formatting";

interface NPCTooltipProps {
    npc: string | null;
    isDragging: boolean;
    popupPosition: {
        x: number;
        y: number;
        position: "above" | "below";
        arrowX: number; // X position where arrow should point
    };
    npcs: Map<string, NPC>;
    happinessFactors?: string[]; // Optional array of happiness factors
}

export default function NPCTooltip({ npc, isDragging, popupPosition, npcs, happinessFactors }: NPCTooltipProps) {
    if (!npc || isDragging) return null;

    // Get snake_case version of the NPC name
    const npcKey = npc;
    const npcObject = npcs.get(npcKey);

    if (!npcObject) return null;

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

            <div className="text-center mb-2 font-bold text-white">{npcObject.name}</div>
            <div className="gap-2 text-sm">
                {npcKey === "princess" ? (
                    <div className="mb-2">
                        <div className="font-semibold mb-1">Special Cases:</div>
                        <ul className="list-disc pl-5 text-sm">
                            <li className="text-slate-300">No biome preferences</li>
                            <li className="text-green-300">Liked by all other NPCs</li>
                            <li className="text-green-500">Loves up to 3 neighbours</li>
                            <li className="text-red-400">Hates having fewer than 2 neighbours</li>
                        </ul>
                    </div>
                ) : (
                    <div className="mb-2">
                        <div className="font-semibold mb-1">Biome Preferences:</div>
                        {npcObject.lovedBiome && (
                            <p>
                                <span className="text-green-500">Loves:</span> {toTitleCase(npcObject.lovedBiome)}
                            </p>
                        )}
                        {npcObject.likedBiome && (
                            <p>
                                <span className="text-green-300">Likes:</span> {toTitleCase(npcObject.likedBiome)}
                            </p>
                        )}
                        {npcObject.dislikedBiome && (
                            <p>
                                <span className="text-orange-400">Dislikes:</span>{" "}
                                {toTitleCase(npcObject.dislikedBiome)}
                            </p>
                        )}
                        {npcObject.hatedBiome && (
                            <p>
                                <span className="text-red-400">Hates:</span> {toTitleCase(npcObject.hatedBiome)}
                            </p>
                        )}
                    </div>
                )}

                {npcObject.hasRelationships() && npcKey !== "princess" && (
                    <div>
                        <div className="border-t border-slate-600 my-2"></div>
                        <div className="font-semibold mb-1">NPC Relationships:</div>
                        {npcObject.lovedNpcs.length > 0 && (
                            <p>
                                <span className="text-green-500">Loves:</span>{" "}
                                {npcObject.lovedNpcs.map((n) => npcs.get(n)?.name || n).join(", ")}
                            </p>
                        )}

                        {npcObject.likedNpcs.length > 0 && (
                            <p>
                                <span className="text-green-300">Likes:</span>{" "}
                                {npcObject.likedNpcs.map((n) => npcs.get(n)?.name || n).join(", ")}
                            </p>
                        )}

                        {npcObject.dislikedNpcs.length > 0 && (
                            <p>
                                <span className="text-orange-400">Dislikes:</span>{" "}
                                {npcObject.dislikedNpcs.map((n) => npcs.get(n)?.name || n).join(", ")}
                            </p>
                        )}

                        {npcObject.hatedNpcs.length > 0 && (
                            <p>
                                <span className="text-red-400">Hates:</span>{" "}
                                {npcObject.hatedNpcs.map((n) => npcs.get(n)?.name || n).join(", ")}
                            </p>
                        )}
                    </div>
                )}

                {/* Display happiness factors if available */}
                {happinessFactors && happinessFactors.length > 0 && (
                    <div>
                        <div className="border-t border-slate-600 my-2"></div>
                        <div className="font-semibold mb-1">Happiness Factors:</div>
                        <ul className="list-disc pl-5 text-sm">
                            {happinessFactors.map((factor, index) => (
                                <li key={index} className="text-slate-300">
                                    {factor}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
