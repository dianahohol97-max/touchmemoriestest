'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraManager } from '@/lib/photobooth/camera';
import { CanvasGenerator } from '@/lib/photobooth/canvas-generator';
import { UploadManager } from '@/lib/photobooth/upload';
import { SoundManager } from '@/lib/photobooth/sounds';
import {
  PhotoboothConfig,
  PhotoboothState,
  CapturedPhoto,
  PhotoboothError,
  PhotoOrientation,
  PhotoSource,
} from '@/lib/photobooth/types';
import { DEFAULT_PHOTOBOOTH_CONFIG } from '@/lib/photobooth/defaults';
import { getLayoutsByOrientation } from '@/lib/photobooth/layouts';

interface PhotoboothCoreProps {
  config?: Partial<PhotoboothConfig>;
  onComplete?: (imageDataUrl: string) => void;
  onError?: (error: PhotoboothError) => void;
  className?: string;
}

export const PhotoboothCore: React.FC<PhotoboothCoreProps> = ({
  config: userConfig,
  onComplete,
  onError,
  className = '',
}) => {
  // Merge user config with defaults
  const config: PhotoboothConfig = {
    ...DEFAULT_PHOTOBOOTH_CONFIG,
    ...userConfig,
    layout: userConfig?.layout || DEFAULT_PHOTOBOOTH_CONFIG.layout,
    capture: {
      ...DEFAULT_PHOTOBOOTH_CONFIG.capture,
      ...userConfig?.capture,
    },
    customization: {
      ...DEFAULT_PHOTOBOOTH_CONFIG.customization,
      ...userConfig?.customization,
    },
  };

  const [state, setState] = useState<PhotoboothState>('idle');
  const [selectedOrientation, setSelectedOrientation] = useState<PhotoOrientation | null>(null);
  const [selectedSource, setSelectedSource] = useState<PhotoSource | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [countdown, setCountdown] = useState<number>(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<PhotoboothError | null>(null);
  const [lastCapturedPhoto, setLastCapturedPhoto] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraManagerRef = useRef<CameraManager | null>(null);
  const canvasGeneratorRef = useRef<CanvasGenerator | null>(null);
  const uploadManagerRef = useRef<UploadManager | null>(null);
  const soundManagerRef = useRef<SoundManager | null>(null);

  // Initialize managers on client-side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      cameraManagerRef.current = new CameraManager();
      canvasGeneratorRef.current = new CanvasGenerator();
      uploadManagerRef.current = new UploadManager(config.capture.maxFileSizeMB || 50);
      soundManagerRef.current = new SoundManager();
    }

    return () => {
      soundManagerRef.current?.dispose();
    };
  }, [config.capture.maxFileSizeMB]);

  // Update sound manager when soundEnabled changes
  useEffect(() => {
    soundManagerRef.current?.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (files: FileList) => {
      if (!uploadManagerRef.current) return;

      setError(null);
      setState('processing');

      try {
        const dataUrls = await uploadManagerRef.current.processMultipleFiles(files);

        const photos: CapturedPhoto[] = dataUrls.map((dataUrl, index) => ({
          id: `photo-${index}-${Date.now()}`,
          dataUrl,
          timestamp: Date.now() + index,
        }));

        // Limit to configured number of photos
        const limitedPhotos = photos.slice(0, config.capture.numberOfPhotos);
        setCapturedPhotos(limitedPhotos);

        // Generate layout
        await generateLayout(limitedPhotos);
      } catch (err) {
        const error: PhotoboothError = {
          code: 'UPLOAD_ERROR',
          message: err instanceof Error ? err.message : 'Failed to process uploaded files',
        };
        setError(error);
        setState('error');
        onError?.(error);
      }
    },
    [config.capture.numberOfPhotos, onError]
  );

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    if (!cameraManagerRef.current) return;

    setState('camera-setup');
    setError(null);

    try {
      if (!cameraManagerRef.current.isSupported()) {
        throw new Error('Camera not supported on this device');
      }

      const stream = await cameraManagerRef.current.requestCameraAccess(
        cameraFacing,
        config.capture.resolution
      );

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
          }
        });
        setState('camera-ready');
      }
    } catch (err) {
      const error: PhotoboothError = {
        code: 'CAMERA_ERROR',
        message: err instanceof Error ? err.message : 'Failed to access camera',
      };
      setError(error);
      setState('error');
      onError?.(error);
    }
  }, [cameraFacing, config.capture.resolution, onError]);

  // Toggle camera (front/back)
  const toggleCamera = useCallback(async () => {
    if (!cameraManagerRef.current || !videoRef.current) return;

    try {
      const stream = await cameraManagerRef.current.toggleCamera();
      const newFacing = cameraManagerRef.current.getCurrentFacing();
      setCameraFacing(newFacing);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
          }
        });
      }
      soundManagerRef.current?.playClick();
    } catch (err) {
      console.error('Failed to toggle camera:', err);
    }
  }, []);

  // Start photo capture sequence
  const startCapture = useCallback(async () => {
    if (!videoRef.current || !cameraManagerRef.current) return;

    setState('countdown');
    setCapturedPhotos([]);
    setCurrentPhotoIndex(0);

    const photos: CapturedPhoto[] = [];

    for (let i = 0; i < config.capture.numberOfPhotos; i++) {
      setCurrentPhotoIndex(i + 1);

      // Countdown
      for (let j = config.capture.countdownSeconds; j > 0; j--) {
        setCountdown(j);
        soundManagerRef.current?.playCountdownBeep(j === 1);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Capture photo
      setState('capturing');
      setCountdown(0);
      soundManagerRef.current?.playShutter();

      const photoDataUrl = await cameraManagerRef.current.capturePhoto(videoRef.current);
      const photo: CapturedPhoto = {
        id: `photo-${i}-${Date.now()}`,
        dataUrl: photoDataUrl,
        timestamp: Date.now(),
      };

      photos.push(photo);
      setLastCapturedPhoto(photoDataUrl);

      // Flash effect
      if (videoRef.current) {
        videoRef.current.style.filter = 'brightness(2)';
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.style.filter = 'brightness(1)';
          }
        }, 200);
      }

      // Show photo review if not last photo
      if (i < config.capture.numberOfPhotos - 1) {
        setState('photo-review');
        setCapturedPhotos([...photos]);

        // Wait for user decision or auto-continue after 3 seconds
        await new Promise<void>((resolve) => {
          const autoResolveTimer = setTimeout(() => {
            resolve();
          }, 3000);

          // Store resolve function for manual confirmation
          (window as any).__photoReviewResolve = () => {
            clearTimeout(autoResolveTimer);
            resolve();
          };
        });

        setState('countdown');
        await new Promise((resolve) => setTimeout(resolve, config.capture.delayBetweenShots));
      } else {
        setCapturedPhotos(photos);
      }
    }

    // Generate final layout
    setState('processing');
    soundManagerRef.current?.playSuccess();
    await generateLayout(photos);
  }, [config.capture]);

  const retakeLastPhoto = useCallback(async () => {
    // Remove last photo and restart countdown
    if (!cameraManagerRef.current || !videoRef.current) return;

    setCapturedPhotos((prev) => prev.slice(0, -1));
    setLastCapturedPhoto(null);
    setState('countdown');

    const i = currentPhotoIndex - 1;

    // Countdown
    for (let j = config.capture.countdownSeconds; j > 0; j--) {
      setCountdown(j);
      soundManagerRef.current?.playCountdownBeep(j === 1);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Capture photo
    setState('capturing');
    setCountdown(0);
    soundManagerRef.current?.playShutter();

    const photoDataUrl = await cameraManagerRef.current.capturePhoto(videoRef.current);
    const photo: CapturedPhoto = {
      id: `photo-${i}-${Date.now()}`,
      dataUrl: photoDataUrl,
      timestamp: Date.now(),
    };

    setCapturedPhotos((prev) => [...prev, photo]);
    setLastCapturedPhoto(photoDataUrl);

    // Flash effect
    if (videoRef.current) {
      videoRef.current.style.filter = 'brightness(2)';
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.style.filter = 'brightness(1)';
        }
      }, 200);
    }

    // Continue with review or next photo
    if (currentPhotoIndex < config.capture.numberOfPhotos) {
      setState('photo-review');
    } else {
      setState('processing');
      soundManagerRef.current?.playSuccess();
      await generateLayout([...capturedPhotos, photo]);
    }
  }, [capturedPhotos, config.capture, currentPhotoIndex]);

  const keepPhoto = useCallback(() => {
    (window as any).__photoReviewResolve?.();
    delete (window as any).__photoReviewResolve;
  }, []);

  const generateLayout = useCallback(
    async (photos: CapturedPhoto[]) => {
      if (!canvasGeneratorRef.current) return;

      try {
        const imageDataUrl = await canvasGeneratorRef.current.generateLayout(
          photos,
          config.layout,
          config.customization
        );

        setGeneratedImage(imageDataUrl);
        setState('preview');
        onComplete?.(imageDataUrl);
      } catch (err) {
        const error: PhotoboothError = {
          code: 'GENERATION_ERROR',
          message: err instanceof Error ? err.message : 'Failed to generate layout',
        };
        setError(error);
        setState('error');
        onError?.(error);
      }
    },
    [config.layout, config.customization, onComplete, onError]
  );

  const reset = useCallback(() => {
    setCapturedPhotos([]);
    setGeneratedImage(null);
    setCurrentPhotoIndex(0);
    setCountdown(0);
    setError(null);
    setSelectedOrientation(null);
    setSelectedSource(null);
    setLastCapturedPhoto(null);
    delete (window as any).__photoReviewResolve;
    if (cameraManagerRef.current) {
      cameraManagerRef.current.stopCamera();
    }
    setState('idle');
  }, []);

  const downloadImage = useCallback(
    (format: 'png' | 'jpg' = 'png') => {
      if (!canvasGeneratorRef.current) return;
      const filename = `photobooth-${Date.now()}.${format}`;
      canvasGeneratorRef.current.downloadImage(filename, format, 1.0);
    },
    []
  );

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraManagerRef.current) {
        cameraManagerRef.current.stopCamera();
      }
      delete (window as any).__photoReviewResolve;
    };
  }, []);

  // Calculate progress percentage
  const progressPercentage = (currentPhotoIndex / config.capture.numberOfPhotos) * 100;

  return (
    <div className={`photobooth-core ${className}`}>
      {/* Error State */}
      {state === 'error' && error && (
        <div className="photobooth-error">
          <div className="error-icon"></div>
          <h3>Oops! Something went wrong</h3>
          <p>{error.message}</p>
          <button onClick={initializeCamera} className="btn-retry">
            Try Again
          </button>
        </div>
      )}

      {/* Idle State */}
      {state === 'idle' && (
        <div className="photobooth-start">
          <div className="start-content">
            <div className="camera-icon"></div>
            <h2>Онлайн Фотобудка</h2>
            <p>Оберіть формат та створіть {config.capture.numberOfPhotos} фотографії</p>
            <button
              onClick={() => {
                setState('format-selection');
                soundManagerRef.current?.playClick();
              }}
              className="btn-start"
            >
              Почати
            </button>
            <div className="sound-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
                <span>Звуки {soundEnabled ? '' : ''}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Format Selection */}
      {state === 'format-selection' && (
        <div className="photobooth-format-selection">
          <div className="format-content">
            <h2>Оберіть формат</h2>
            <div className="format-options">
              <button
                onClick={() => {
                  setSelectedOrientation('portrait');
                  setState('source-selection');
                  soundManagerRef.current?.playClick();
                }}
                className="btn-format"
              >
                <div className="format-icon"></div>
                <span>Портрет</span>
                <small>Вертикальний</small>
              </button>
              <button
                onClick={() => {
                  setSelectedOrientation('landscape');
                  setState('source-selection');
                  soundManagerRef.current?.playClick();
                }}
                className="btn-format"
              >
                <div className="format-icon"></div>
                <span>Ландшафт</span>
                <small>Горизонтальний</small>
              </button>
              <button
                onClick={() => {
                  setSelectedOrientation('square');
                  setState('source-selection');
                  soundManagerRef.current?.playClick();
                }}
                className="btn-format"
              >
                <div className="format-icon"></div>
                <span>Квадрат</span>
                <small>1:1</small>
              </button>
            </div>
            <button onClick={() => setState('idle')} className="btn-back">
              ← Назад
            </button>
          </div>
        </div>
      )}

      {/* Source Selection */}
      {state === 'source-selection' && (
        <div className="photobooth-source-selection">
          <div className="source-content">
            <h2>Як ви хочете додати фото?</h2>
            <div className="source-options">
              <button
                onClick={() => {
                  setSelectedSource('camera');
                  soundManagerRef.current?.playClick();
                  initializeCamera();
                }}
                className="btn-source"
              >
                <div className="source-icon"></div>
                <span>Зробити фото</span>
                <small>Використати камеру</small>
              </button>
              <button
                onClick={() => {
                  setSelectedSource('upload');
                  setState('upload-ready');
                  soundManagerRef.current?.playClick();
                }}
                className="btn-source"
              >
                <div className="source-icon"></div>
                <span>Завантажити</span>
                <small>Вибрати з галереї</small>
              </button>
            </div>
            <button onClick={() => setState('format-selection')} className="btn-back">
              ← Назад
            </button>
          </div>
        </div>
      )}

      {/* Upload Ready State */}
      {state === 'upload-ready' && (
        <div className="photobooth-upload">
          <div className="upload-content">
            <div className="upload-icon"></div>
            <h2>Завантажте фотографії</h2>
            <p>
              Виберіть до {config.capture.numberOfPhotos} фотографій
              <br />
              <small>Максимальний розмір файлу: {config.capture.maxFileSizeMB || 50}MB</small>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files);
                }
              }}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-upload"
            >
              Вибрати фотографії
            </button>
            <button onClick={() => setState('source-selection')} className="btn-back">
              ← Назад
            </button>
          </div>
        </div>
      )}

      {/* Camera Setup */}
      {state === 'camera-setup' && (
        <div className="photobooth-loading">
          <div className="spinner"></div>
          <p>Налаштування камери...</p>
        </div>
      )}

      {/* Camera View */}
      {(state === 'camera-ready' || state === 'countdown' || state === 'capturing') && (
        <div className="photobooth-camera">
          {/* Progress Bar */}
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercentage}%` }}></div>
            <div className="progress-text">
              {currentPhotoIndex} / {config.capture.numberOfPhotos}
            </div>
          </div>

          <div className="camera-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-preview"
              style={{
                transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none',
              }}
            />

            {/* Countdown Overlay */}
            {state === 'countdown' && countdown > 0 && (
              <div className="countdown-overlay">
                <div className="countdown-number animate-pulse">{countdown}</div>
              </div>
            )}

            {/* Capture Flash */}
            {state === 'capturing' && countdown === 0 && (
              <div className="capture-flash"></div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {capturedPhotos.length > 0 && (
            <div className="thumbnail-strip">
              {capturedPhotos.map((photo, index) => (
                <div key={photo.id} className="thumbnail animate-fadeIn">
                  <img src={photo.dataUrl} alt={`Photo ${index + 1}`} />
                  <div className="thumbnail-number">{index + 1}</div>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="camera-controls">
            {state === 'camera-ready' && (
              <>
                <button onClick={toggleCamera} className="btn-toggle-camera" title="Переключити камеру">
                  
                </button>
                <button onClick={startCapture} className="btn-capture">
                  Почати зйомку
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Photo Review */}
      {state === 'photo-review' && lastCapturedPhoto && (
        <div className="photobooth-review">
          <h3>Перегляд фото {currentPhotoIndex}</h3>
          <div className="review-container">
            <img src={lastCapturedPhoto} alt={`Photo ${currentPhotoIndex}`} className="review-image" />
          </div>
          <div className="review-controls">
            <button onClick={retakeLastPhoto} className="btn-retake">
               Переробити
            </button>
            <button onClick={keepPhoto} className="btn-keep">
               Залишити
            </button>
          </div>
          <p className="review-hint">Автоматично продовжиться через 3 секунди...</p>
        </div>
      )}

      {/* Processing */}
      {state === 'processing' && (
        <div className="photobooth-loading">
          <div className="spinner"></div>
          <p>Створення макету...</p>
        </div>
      )}

      {/* Preview */}
      {state === 'preview' && generatedImage && (
        <div className="photobooth-preview">
          <h3>Ваші фото готові! </h3>
          <div className="preview-container">
            <img src={generatedImage} alt="Generated photobooth layout" className="preview-image" />
          </div>

          <div className="preview-controls">
            <button onClick={() => downloadImage('png')} className="btn-download">
               Завантажити PNG
            </button>
            <button onClick={() => downloadImage('jpg')} className="btn-download">
               Завантажити JPG
            </button>
            <button onClick={reset} className="btn-secondary">
               Нові фото
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoboothCore;
