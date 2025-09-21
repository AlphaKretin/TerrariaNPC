"use client";

// Define types for the JSON data structure - reusing from page.tsx
interface NpcData {
    npc: {
        [relatedNpc: string]: number;
    };
    biome: {
        [biomeName: string]: number;
    };
}

export type NpcJson = {
    [npcKey: string]: NpcData;
};

/**
 * NPC class that encapsulates all NPC-related functionality
 * to avoid prop drilling between components
 */
export class NPC {
    public id: string;
    private npcData: NpcData;

    constructor(id: string, npcData: NpcData) {
        this.id = id;
        this.npcData = npcData;
    }

    /**
     * Format snake_case to Title Case (e.g., "arms_dealer" -> "Arms Dealer")
     */
    get name(): string {
        return this.id
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    /**
     * Get biome preference type based on value (1 = loved, -1 = hated)
     */
    static getPreference(value: number): string {
        if (value === 2) return "loves";
        if (value === 1) return "likes";
        if (value === -1) return "dislikes";
        if (value === -2) return "hates";
        return "neutral";
    }

    private getNpcsWithValue(value: number): string[] {
        return Object.entries(this.npcData.npc)
            .filter(([, val]) => val === value)
            .map(([relatedNpc]) => relatedNpc);
    }

    public getValueForNpc(npc: string): number {
        return this.npcData.npc[npc] || 0;
    }

    /**
     * Get all NPCs that an NPC loves (value 2 in JSON)
     */
    get lovedNpcs(): string[] {
        return this.getNpcsWithValue(2);
    }

    /**
     * Get all NPCs that an NPC likes (value 1 in JSON)
     */
    get likedNpcs(): string[] {
        return this.getNpcsWithValue(1);
    }

    /**
     * Get all NPCs that an NPC dislikes (value -1 in JSON)
     */
    get dislikedNpcs(): string[] {
        return this.getNpcsWithValue(-1);
    }

    /**
     * Get all NPCs that an NPC hates (value -2 in JSON)
     */
    get hatedNpcs(): string[] {
        return this.getNpcsWithValue(-2);
    }

    getBiomeWithValue(value: number): string {
        const biomes = Object.entries(this.npcData.biome)
            .filter(([, val]) => value === val)
            .map(([biome]) => biome);
        return biomes[0];
    }

    getValueForBiome(biome: string): number {
        return this.npcData.biome[biome] || 0;
    }

    /**
     * Get the loved biome (value 1 in JSON)
     */
    get likedBiome(): string {
        return this.getBiomeWithValue(1);
    }

    /**
     * Get the hated biome (value -1 in JSON)
     */
    get dislikedBiome(): string {
        return this.getBiomeWithValue(-1);
    }

    /**
     * Check if an NPC has any relationships
     */
    hasRelationships(): boolean {
        return (
            this.lovedNpcs.length > 0 ||
            this.likedNpcs.length > 0 ||
            this.dislikedNpcs.length > 0 ||
            this.hatedNpcs.length > 0
        );
    }
}
