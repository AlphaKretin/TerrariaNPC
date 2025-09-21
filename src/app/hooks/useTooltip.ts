"use client";

import { useEffect, useRef, useState } from "react";

interface TooltipPosition {
    x: number; // Final x position (may be adjusted to fit screen)
    y: number; // Final y position
    position: "above" | "below"; // Whether tooltip is above or below the element
    arrowX: number; // Exact x position where arrow should point (centered on element)
}

export function useTooltip() {
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [popupPosition, setPopupPosition] = useState<TooltipPosition>({
        x: 0,
        y: 0,
        position: "above",
        arrowX: 0,
    });
    const hoveredElementRef = useRef<Element | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Function to determine tooltip position accounting for page scroll
    const calculateTooltipPosition = (targetElement: Element): TooltipPosition => {
        // Get element rectangle relative to viewport
        const rect = targetElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        // Calculate horizontal position (centered on element)
        const centerX = rect.left + rect.width / 2;

        // Keep horizontal position within viewport bounds
        const minX = 150; // Half of maxWidth (300px)
        const maxX = viewportWidth - 150;
        const x = Math.max(minX, Math.min(centerX, maxX));

        // Store the actual center position for the arrow
        const arrowX = centerX;

        // Calculate vertical position - start with the assumption we'll place it above
        let position: "above" | "below" = "above";
        let y = rect.top; // Position at the top of the element

        // If there's not enough space above (need ~220px), position below
        if (rect.top < 220) {
            position = "below";
            y = rect.bottom; // Position at the bottom of the element
        } else {
            // Add a small offset to ensure the tooltip doesn't overlap the mouse cursor
            y -= 10; // Extra gap when tooltip is above
        }

        return { x, y, position, arrowX };
    };

    const handleMouseEnter = (item: string, e: React.MouseEvent) => {
        // Don't show tooltip if currently dragging
        if (isDragging) return;

        setHoveredItem(item);

        // Calculate tooltip position from the event target
        const newPosition = calculateTooltipPosition(e.currentTarget);
        setPopupPosition(newPosition);

        // Store the reference to the hovered element
        hoveredElementRef.current = e.currentTarget;
    };

    const handleMouseLeave = () => {
        setHoveredItem(null);
        hoveredElementRef.current = null;
    };

    // Emergency function to reset dragging state if tooltips get stuck
    const resetDraggingState = () => {
        setIsDragging(false);
    };

    // useEffect for tracking global drag events
    useEffect(() => {
        const handleDragStart = () => {
            setIsDragging(true);
            // Hide tooltip when a drag operation starts anywhere in the document
            setHoveredItem(null);
        };

        const handleDragEnd = () => {
            setIsDragging(false);
        };

        document.addEventListener("dragstart", handleDragStart);
        document.addEventListener("dragend", handleDragEnd);
        document.addEventListener("drop", handleDragEnd); // Also listen for drop events

        return () => {
            document.removeEventListener("dragstart", handleDragStart);
            document.removeEventListener("dragend", handleDragEnd);
            document.removeEventListener("drop", handleDragEnd);
        };
    }, []);

    // useEffect to ensure dragging state is reset after dragging
    useEffect(() => {
        if (!isDragging) return; // Only add listeners when actually dragging

        // Function to reset dragging state on mouse up anywhere
        const handleGlobalMouseUp = () => {
            setIsDragging(false);
        };

        // Add listeners
        document.addEventListener("mouseup", handleGlobalMouseUp);

        return () => {
            document.removeEventListener("mouseup", handleGlobalMouseUp);
        };
    }, [isDragging]);

    // useEffect for tooltip position adjustment
    useEffect(() => {
        // Skip if no tooltip is shown or if dragging
        if (!hoveredItem || !hoveredElementRef.current || isDragging) return;

        const handleResize = () => {
            // When window resizes, just hide the tooltip for simplicity
            setHoveredItem(null);
        };

        const handleScroll = () => {
            // When page scrolls, either recalculate position or hide tooltip
            if (hoveredElementRef.current) {
                // Recalculate position based on current element position
                const newPosition = calculateTooltipPosition(hoveredElementRef.current);
                setPopupPosition(newPosition);
            } else {
                // If we can't find the element, hide the tooltip
                setHoveredItem(null);
            }
        };

        window.addEventListener("resize", handleResize);
        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("scroll", handleScroll);
        };
    }, [hoveredItem, isDragging]);

    return {
        hoveredItem,
        popupPosition,
        isDragging,
        setIsDragging,
        handleMouseEnter,
        handleMouseLeave,
        resetDraggingState,
    };
}
