// Camera access and control utilities

export class CameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private currentFacing: 'user' | 'environment' = 'user';

  async requestCameraAccess(
    facing: 'user' | 'environment' = 'user',
    resolution: { width: number; height: number } = { width: 1920, height: 1080 }
  ): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: resolution.width },
          height: { ideal: resolution.height },
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentFacing = facing;
      return this.stream;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Camera access denied. Please allow camera permissions.');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No camera found on this device.');
        } else if (error.name === 'NotReadableError') {
          throw new Error('Camera is already in use by another application.');
        }
      }
      throw new Error('Failed to access camera.');
    }
  }

  attachToVideo(videoElement: HTMLVideoElement, stream: MediaStream): void {
    this.videoElement = videoElement;
    videoElement.srcObject = stream;
    videoElement.play();
  }

  async capturePhoto(videoElement: HTMLVideoElement): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Draw the current video frame
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Convert to data URL (high quality)
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    });
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  switchCamera(facing: 'user' | 'environment'): Promise<MediaStream> {
    this.stopCamera();
    return this.requestCameraAccess(facing);
  }

  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  }

  getCurrentFacing(): 'user' | 'environment' {
    return this.currentFacing;
  }

  async toggleCamera(): Promise<MediaStream> {
    const newFacing = this.currentFacing === 'user' ? 'environment' : 'user';
    return this.switchCamera(newFacing);
  }
}
