'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { X, Upload, Loader2, AlertCircle } from 'lucide-react';
import type { PhotoMetadata } from '@/lib/types/designer-service';

interface PhotoUploaderProps {
  token: string;
  orderId: string;
  initialPhotos?: PhotoMetadata[];
  onPhotosChange?: (photos: PhotoMetadata[]) => void;
  maxPhotos?: number;
}

export default function PhotoUploader({
  token,
  orderId,
  initialPhotos = [],
  onPhotosChange,
  maxPhotos = 200,
}: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<PhotoMetadata[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const updatePhotos = (newPhotos: PhotoMetadata[]) => {
    setPhotos(newPhotos);
    onPhotosChange?.(newPhotos);
  };

  const uploadFile = async (file: File): Promise<PhotoMetadata | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', token);
      formData.append('orderId', orderId);

      const response = await fetch('/api/designer-service/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      return data.photo;
    } catch (err: any) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (photos.length + acceptedFiles.length > maxPhotos) {
        setError(`Максимальна кількість фото: ${maxPhotos}`);
        return;
      }

      setUploading(true);
      setError(null);
      setUploadProgress(0);

      const totalFiles = acceptedFiles.length;
      let completed = 0;

      // Upload files in parallel (batches of 5)
      const batchSize = 5;
      const uploadedPhotos: PhotoMetadata[] = [];

      for (let i = 0; i < acceptedFiles.length; i += batchSize) {
        const batch = acceptedFiles.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(uploadFile));

        results.forEach((photo) => {
          if (photo) {
            uploadedPhotos.push(photo);
          }
          completed++;
          setUploadProgress(Math.round((completed / totalFiles) * 100));
        });
      }

      if (uploadedPhotos.length > 0) {
        updatePhotos([...photos, ...uploadedPhotos]);
      }

      if (uploadedPhotos.length < acceptedFiles.length) {
        setError(
          `Завантажено ${uploadedPhotos.length} з ${acceptedFiles.length} фото. Деякі файли не вдалося завантажити.`
        );
      }

      setUploading(false);
      setUploadProgress(0);
    },
    [photos, maxPhotos, token, orderId]
  );

  const deletePhoto = async (photoId: string) => {
    try {
      const response = await fetch(
        `/api/designer-service/upload?token=${token}&photoId=${photoId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      updatePhotos(photos.filter((p) => p.id !== photoId));
    } catch (err) {
      console.error('Delete error:', err);
      setError('Не вдалося видалити фото');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.heic'],
    },
    multiple: true,
    disabled: uploading,
  });

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-[3px] p-12 text-center cursor-pointer
          transition-colors
          ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg text-blue-600">Відпустіть файли тут...</p>
        ) : (
          <div>
            <p className="text-lg text-gray-700 mb-2">
              Перетягніть фото сюди або клацніть для вибору
            </p>
            <p className="text-sm text-gray-500">
              JPG, PNG, HEIC • До {maxPhotos} фото • Рекомендовано 20-50 фото
            </p>
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-[3px] p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-blue-900">
              Завантаження фото... {uploadProgress}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[3px] p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Photos Count */}
      {photos.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            Завантажено: {photos.length} {photos.length === 1 ? 'фото' : 'фото'}
          </p>
          <p className="text-xs text-gray-500">
            Ліміт: {maxPhotos} фото
          </p>
        </div>
      )}

      {/* Photos Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <div className="aspect-square relative rounded-[3px] overflow-hidden bg-gray-100">
                <Image
                  src={photo.url}
                  alt={photo.filename}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                />
              </div>
              <button
                onClick={() => deletePhoto(photo.id)}
                className="
                  absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1
                  opacity-0 group-hover:opacity-100 transition-opacity
                  hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                "
                title="Видалити фото"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-xs text-gray-500 mt-1 truncate" title={photo.filename}>
                {photo.filename}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {photos.length === 0 && !uploading && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            Ще не завантажено жодного фото
          </p>
        </div>
      )}
    </div>
  );
}
