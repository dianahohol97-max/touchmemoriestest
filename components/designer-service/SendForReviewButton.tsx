'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

interface SendForReviewButtonProps {
  briefId: string;
  projectId?: string;
  status: string;
}

export default function SendForReviewButton({
  briefId,
  projectId,
  status,
}: SendForReviewButtonProps) {
  const [sending, setSending] = useState(false);

  const handleSendForReview = async () => {
    if (!projectId) {
      alert('Спочатку створіть дизайн проекту');
      return;
    }

    if (!confirm('Надіслати дизайн клієнту на перегляд?')) {
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/designer-service/send-for-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, projectId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send for review');
      }

      const data = await response.json();

      alert(
        `Дизайн надіслано на перегляд!\n\n` +
        `Email надіслано: ${data.emailSent ? 'Так' : 'Ні'}\n` +
        `Ревізія: ${data.revisionNumber}`
      );

      window.location.reload();
    } catch (error) {
      console.error('Error sending for review:', error);
      alert('Помилка при відправці на перегляд');
    } finally {
      setSending(false);
    }
  };

  // Only show button for certain statuses
  if (!['ai_done', 'in_design', 'revision_requested'].includes(status)) {
    return null;
  }

  return (
    <button
      onClick={handleSendForReview}
      disabled={sending || !projectId}
      className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-[3px] font-medium transition-colors ${
        sending || !projectId
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-green-600 text-white hover:bg-green-700'
      }`}
    >
      <Send className="h-4 w-4" />
      {sending ? 'Відправляємо...' : 'Надіслати на перегляд'}
    </button>
  );
}
