import { useEffect, useState } from "react";
import { House } from "./DroppableHouse";

interface SaveLoadProps {
    placements: House[];
    onLoadPlacements: (placements: House[]) => void;
}

export interface SavedLayout {
    name: string;
    placements: House[];
    savedAt: string;
}

const SaveLoad = ({ placements, onLoadPlacements }: SaveLoadProps) => {
    const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
    const [layoutName, setLayoutName] = useState("");
    const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);

    // Load saved layouts from localStorage on component mount
    useEffect(() => {
        const loadSavedLayouts = () => {
            try {
                const layouts = localStorage.getItem("terrariaNPCLayouts");
                if (layouts) {
                    setSavedLayouts(JSON.parse(layouts));
                }
            } catch (error) {
                console.error("Error loading saved layouts:", error);
            }
        };

        loadSavedLayouts();
    }, []);

    // Save current layout to localStorage
    const saveCurrentLayout = () => {
        if (!layoutName.trim()) return;

        try {
            const newLayout: SavedLayout = {
                name: layoutName.trim(),
                placements: placements,
                savedAt: new Date().toISOString(),
            };

            // Check if a layout with this name already exists
            const layoutExists = savedLayouts.findIndex((layout) => layout.name === newLayout.name) !== -1;

            let updatedLayouts: SavedLayout[];

            if (layoutExists) {
                // Update existing layout
                updatedLayouts = savedLayouts.map((layout) => (layout.name === newLayout.name ? newLayout : layout));
            } else {
                // Add new layout
                updatedLayouts = [...savedLayouts, newLayout];
            }

            // Save to localStorage
            localStorage.setItem("terrariaNPCLayouts", JSON.stringify(updatedLayouts));

            // Update state
            setSavedLayouts(updatedLayouts);
            setLayoutName("");
        } catch (error) {
            console.error("Error saving layout:", error);
        }
    };

    // Load a saved layout
    const loadLayout = (layoutName: string) => {
        const layout = savedLayouts.find((l) => l.name === layoutName);

        if (layout) {
            onLoadPlacements(layout.placements);
            setSelectedLayout(layout.name);
            setShowDropdown(false);
        }
    };

    // Delete a saved layout
    const deleteLayout = (layoutName: string, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent triggering the parent onClick (load layout)

        try {
            const updatedLayouts = savedLayouts.filter((layout) => layout.name !== layoutName);
            localStorage.setItem("terrariaNPCLayouts", JSON.stringify(updatedLayouts));
            setSavedLayouts(updatedLayouts);

            if (selectedLayout === layoutName) {
                setSelectedLayout(null);
            }
        } catch (error) {
            console.error("Error deleting layout:", error);
        }
    };

    // Format the saved date for display
    const formatSavedDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + " " + date.toLocaleTimeString();
        } catch (e) {
            return "Unknown date";
        }
    };

    return (
        <div className="bg-slate-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-3">Save/Load Layout</h2>

            {/* Save interface */}
            <div className="flex flex-wrap gap-2 mb-4">
                <input
                    type="text"
                    placeholder="Layout name"
                    className="bg-slate-700 text-white px-3 py-2 rounded flex-grow"
                    value={layoutName}
                    onChange={(e) => setLayoutName(e.target.value)}
                />
                <button
                    onClick={saveCurrentLayout}
                    disabled={!layoutName.trim()}
                    className="bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white py-2 px-4 rounded"
                >
                    Save
                </button>
            </div>

            {/* Load dropdown */}
            <div className="relative">
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded w-full text-left flex justify-between items-center"
                >
                    <span>{selectedLayout ? `Loaded: ${selectedLayout}` : "Load Layout"}</span>
                    <span className="ml-2">▼</span>
                </button>

                {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                        {savedLayouts.length > 0 ? (
                            <ul>
                                {savedLayouts.map((layout) => (
                                    <li
                                        key={layout.name}
                                        onClick={() => loadLayout(layout.name)}
                                        className="px-3 py-2 hover:bg-slate-600 cursor-pointer flex justify-between items-center"
                                    >
                                        <div>
                                            <div>{layout.name}</div>
                                            <div className="text-xs text-slate-400">
                                                {formatSavedDate(layout.savedAt)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => deleteLayout(layout.name, e)}
                                            className="text-red-500 hover:text-red-300 ml-2"
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="px-3 py-2 text-slate-400">No saved layouts</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SaveLoad;
