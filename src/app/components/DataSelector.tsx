"use client";

import { useCallback } from "react";

export type DataSource = {
    id: string; // file name without extension
    name: string; // display name
    enabled: boolean;
};

export type DataSelectorProps = {
    dataSources: DataSource[];
    onDataSourceChange: (dataSources: DataSource[]) => void;
    className?: string;
};

export const DataSelector = ({ dataSources, onDataSourceChange, className = "" }: DataSelectorProps) => {
    // Handle checkbox change
    const handleCheckboxChange = useCallback(
        (id: string) => {
            const updatedSources = dataSources.map((source) =>
                source.id === id ? { ...source, enabled: !source.enabled } : source
            );
            onDataSourceChange(updatedSources);
        },
        [dataSources, onDataSourceChange]
    );

    return (
        <div className={`data-selector ${className}`}>
            <h3 className="text-lg font-medium mb-2">Additional Data Sources</h3>
            <div className="flex flex-wrap gap-4">
                {dataSources.map((source) => (
                    <label key={source.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={source.enabled}
                            onChange={() => handleCheckboxChange(source.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4"
                        />
                        <span>{source.name}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

export default DataSelector;
