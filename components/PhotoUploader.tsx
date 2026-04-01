'use client';

import React, { useState, useCallback, useRef } from 'react';
import { UploadCloud, X, CheckCircle, AlertCircle, ImageIcon } from 'lucide-react';

export interface PhotoUploaderProps {
  maxFiles: number;
  minFiles: number;
  canvasSize: { width: number; height: number };
  onPhotosChange: (files: File[]) => void;
  label?: string;
}

interface PhotoPreview {
  id: string;
  file: File;
  previewUrl: string;
}

export default function PhotoUploader({
  maxFiles,
  minFiles,
  canvasSize,
  onPhotosChange,
  label,
}: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      return `Only JPG and PNG files are accepted (${file.name})`;
    }
    if (file.size > 50 * 1024 * 1024) {
      return `File is too large (max 50MB) (${file.name})`;
    }
    return null;
  };

  const handleFiles = useCallback((newFiles: File[]) => {
    setError(null);
    
    // Check total limit
    if (photos.length + newFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} photos allowed. You tried to add ${newFiles.length} more.`);
      return;
    }

    const validNewPhotos: PhotoPreview[] = [];
    let validationError: string | null = null;

    for (const file of newFiles) {
      const err = validateFile(file);
      if (err) {
        validationError = err;
        break; // Stop on first error to avoid overwhelming the user
      }

      validNewPhotos.push({
        id: Math.random().toString(36).substring(7) + Date.now().toString(),
        file,
        previewUrl: URL.createObjectURL(file), // Generate local preview URL
      });
    }

    if (validationError) {
      setError(validationError);
      // Wait, we don't return early if valid photos exist. We just show error, but still add valid ones. 
      // Actually normally it's better to reject all if batch fails or accept the valid ones. 
      // We will stop on error, but still append whatever valid ones we processed before the error.
    }

    if (validNewPhotos.length > 0) {
      const updatedPhotos = [...photos, ...validNewPhotos];
      setPhotos(updatedPhotos);
      onPhotosChange(updatedPhotos.map(p => p.file));
    }
  }, [photos, maxFiles, onPhotosChange]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      handleFiles(droppedFiles);
    }
  }, [handleFiles]);

  const onFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
    // Reset input so the same file could be selected again if added, removed, and added again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);

  const removePhoto = useCallback((idToRemove: string) => {
    setPhotos(prevPhotos => {
      const photoToRemove = prevPhotos.find(p => p.id === idToRemove);
      if (photoToRemove) {
         URL.revokeObjectURL(photoToRemove.previewUrl); // Cleanup memory
      }
      const newPhotos = prevPhotos.filter(p => p.id !== idToRemove);
      onPhotosChange(newPhotos.map(p => p.file));
      return newPhotos;
    });
    setError(null);
  }, [onPhotosChange]);

  const removeAllPhotos = useCallback(() => {
    photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    onPhotosChange([]);
    setError(null);
  }, [photos, onPhotosChange]);

  const isSatisfied = photos.length >= minFiles && photos.length <= maxFiles;

  return (
    <div className="w-full font-sans">
      {label && <h3 className="text-lg font-medium text-gray-900 mb-2">{label}</h3>}
      
      {/* Dropzone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full relative p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ease-in-out
          ${isDragging 
              ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 bg-white'}`}
      >
        <div className="p-4 bg-gray-100 rounded-full mb-4 text-gray-500">
           <UploadCloud size={32} strokeWidth={1.5} />
        </div>
        <p className="text-base font-semibold text-gray-800 mb-1">
          Click to upload or drag and drop
        </p>
        <p className="text-sm text-gray-500 mb-4">
          JPG or PNG (max. 50MB)
        </p>
        
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-md">
          <ImageIcon size={14} />
          Recommended resolution: {canvasSize.width} × {canvasSize.height} px
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileInputChange}
          multiple
          accept="image/jpeg, image/png"
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 flex items-center p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200 shadow-sm animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} className="mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Warnings & Status */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <div className="text-gray-700 font-medium tracking-tight">
            {photos.length} of {maxFiles} photos uploaded
          </div>
          {photos.length < minFiles && photos.length > 0 && (
            <div className="text-amber-600 flex items-center gap-1.5 font-medium animate-in fade-in">
              <AlertCircle size={14} />
              Please upload at least {minFiles} photos
            </div>
          )}
          {isSatisfied && (
            <div className="text-emerald-600 flex items-center gap-1.5 font-medium animate-in fade-in">
              <CheckCircle size={14} />
              Ready to proceed
            </div>
          )}
        </div>
        
        {photos.length > 0 && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); removeAllPhotos(); }}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Post-upload thumbnails */}
      {photos.length > 0 && (
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square rounded-lg border border-gray-200 bg-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all">
              {/* Note: Using standard <img> tag for blob URLs to avoid next/image limitations around blob protocols */}
              <img
                src={photo.previewUrl}
                alt={photo.file.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePhoto(photo.id);
                }}
                className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-gray-700 hover:text-red-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100 shadow-sm scale-90 group-hover:scale-100"
                aria-label="Remove photo"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
