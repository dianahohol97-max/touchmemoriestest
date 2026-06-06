'use client';
import { useState } from 'react';

/**
 * Drag-and-drop for any upload zone. Pass a callback that receives the dropped
 * FileList; spread `dropProps` onto the clickable upload element and use
 * `dragActive` to highlight it. Mirrors the file-dialog path so accepted
 * formats (incl. HEIC) behave identically.
 *
 *   const { dragActive, dropProps } = useDropZone(files => handleFiles(files));
 *   <div {...dropProps} style={{ borderColor: dragActive ? '#1e2d7d' : '#cbd5e1' }} />
 */
export function useDropZone(onFiles: (files: FileList) => void) {
    const [dragActive, setDragActive] = useState(false);
    return {
        dragActive,
        dropProps: {
            onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (!dragActive) setDragActive(true); },
            onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); },
            onDragLeave: (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); },
            onDrop: (e: React.DragEvent) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
            },
        },
    };
}
