'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageFlipViewer from '@/components/designer-service/PageFlipViewer';
import CommentPanel from '@/components/designer-service/CommentPanel';
import { CheckCircle, MessageSquare } from 'lucide-react';

interface Comment {
  page: number;
  text: string;
}

interface ReviewPageClientProps {
  revision: any;
  orderNumber: string;
  customerName: string;
}

export default function ReviewPageClient({
  revision,
  orderNumber,
  customerName,
}: ReviewPageClientProps) {
  const router = useRouter();
  const [pageComments, setPageComments] = useState<Comment[]>(
    revision.client_comments || []
  );
  const [generalFeedback, setGeneralFeedback] = useState(
    revision.general_feedback || ''
  );
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mock pages - in real app, this would come from project canvas_data
  const pages = Array.from({ length: 20 }, (_, i) => ({
    pageNumber: i + 1,
    imageUrl: `https://via.placeholder.com/400x400?text=Page+${i + 1}`,
    hasComments: pageComments.some((c) => c.page === i + 1),
  }));

  const handlePageClick = (pageNumber: number) => {
    setSelectedPage(pageNumber);
  };

  const handleSaveComment = (comment: Comment) => {
    setPageComments((prev) => {
      // Remove existing comment for this page
      const filtered = prev.filter((c) => c.page !== comment.page);
      // Add new comment if not empty
      if (comment.text.trim()) {
        return [...filtered, comment];
      }
      return filtered;
    });
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/designer-service/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: revision.client_token,
          decision: 'approved',
          pageComments,
          generalFeedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit approval');
      }

      router.refresh();
    } catch (error) {
      console.error('Error approving design:', error);
      alert('Помилка при затвердженні дизайну. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevisions = async () => {
    if (pageComments.length === 0 && !generalFeedback.trim()) {
      alert('Будь ласка, залиште хоча б один коментар або загальний відгук');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/designer-service/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: revision.client_token,
          decision: 'revision_requested',
          pageComments,
          generalFeedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit revision request');
      }

      router.refresh();
    } catch (error) {
      console.error('Error requesting revisions:', error);
      alert('Помилка при відправці запиту на правки. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  const maxRevisions = 2; // Should come from product settings
  const remainingRevisions = maxRevisions - (revision.revision_count || 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Перегляд дизайну вашого фотоальбому
          </h1>
          <p className="text-lg text-gray-600">
            Замовлення #{orderNumber} • {customerName}
          </p>
          {remainingRevisions > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Залишилось безкоштовних правок: {remainingRevisions}
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-[3px] p-4 mb-6 max-w-4xl mx-auto">
          <p className="text-sm text-blue-800">
            💡 <strong>Як працювати з дизайном:</strong> Клацайте на сторінки,
            щоб залишити коментарі. Після перегляду ви можете затвердити дизайн
            або запросити правки. Ви маєте право на {maxRevisions} безкоштовні
            правки.
          </p>
        </div>

        {/* Page Viewer */}
        <div className="mb-8">
          <PageFlipViewer pages={pages} onPageClick={handlePageClick} />
        </div>

        {/* Comments Summary */}
        {pageComments.length > 0 && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-white rounded-[3px] shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Ваші коментарі ({pageComments.length})
              </h3>
              <div className="space-y-2">
                {pageComments.map((comment) => (
                  <div
                    key={comment.page}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded"
                  >
                    <div className="font-medium text-sm text-gray-700 min-w-[80px]">
                      Стор. {comment.page}:
                    </div>
                    <div className="text-sm text-gray-600">{comment.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* General Feedback */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-white rounded-[3px] shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              Загальний відгук (опціонально)
            </h3>
            <textarea
              value={generalFeedback}
              onChange={(e) => setGeneralFeedback(e.target.value)}
              placeholder="Ваші загальні враження від дизайну, додаткові побажання..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-[3px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-[3px] shadow p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <button
                onClick={handleApprove}
                disabled={submitting}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-[3px] font-semibold text-lg transition-colors ${
                  submitting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <CheckCircle className="h-6 w-6" />
                {submitting ? 'Обробка...' : 'Затвердити дизайн'}
              </button>

              <button
                onClick={handleRequestRevisions}
                disabled={submitting || remainingRevisions === 0}
                className={`flex-1 px-6 py-4 rounded-[3px] font-semibold text-lg transition-colors ${
                  submitting || remainingRevisions === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {submitting
                  ? 'Обробка...'
                  : remainingRevisions === 0
                  ? 'Немає доступних правок'
                  : 'Запросити правки'}
              </button>
            </div>

            {remainingRevisions === 0 && (
              <p className="text-sm text-orange-600 text-center mt-4">
                ⚠️ Ви використали всі безкоштовні правки. Додаткові правки можуть
                бути платними.
              </p>
            )}
          </div>
        </div>

        {/* Help */}
        <div className="max-w-4xl mx-auto mt-6">
          <div className="bg-gray-100 rounded-[3px] p-4 text-center">
            <p className="text-sm text-gray-600">
              Потрібна допомога?{' '}
              <a
                href="mailto:info@touchmemories.com.ua"
                className="text-blue-600 hover:text-blue-800"
              >
                info@touchmemories.com.ua
              </a>{' '}
              або Telegram{' '}
              <a
                href="https://t.me/touchmemories"
                className="text-blue-600 hover:text-blue-800"
              >
                @touchmemories
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Comment Panel Modal */}
      {selectedPage !== null && (
        <CommentPanel
          pageNumber={selectedPage}
          existingComment={pageComments.find((c) => c.page === selectedPage)?.text}
          onClose={() => setSelectedPage(null)}
          onSave={handleSaveComment}
        />
      )}
    </div>
  );
}
