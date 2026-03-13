'use client';

import React from 'react';
import { PhotoboothEmbed } from '@/components/photobooth';

export default function PhotoboothPage() {
  const handleComplete = (imageDataUrl: string) => {
    console.log('Photobooth session completed!');
    console.log('Image data URL length:', imageDataUrl.length);
    // You can save the image to your backend here
  };

  const handleError = (error: { code: string; message: string }) => {
    console.error('Photobooth error:', error);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <PhotoboothEmbed
        onComplete={handleComplete}
        onError={handleError}
        allowConfiguration={true}
      />
    </div>
  );
}
