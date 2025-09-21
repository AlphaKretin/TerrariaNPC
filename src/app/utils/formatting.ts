"use client";

/**
 * Converts a string to title case
 * Example: "forest_biome" -> "Forest Biome"
 */
export function toTitleCase(s: string): string {
    return s
        .split(/[ _]/) // Split by space or underscore
        .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
        .join(" ");
}
