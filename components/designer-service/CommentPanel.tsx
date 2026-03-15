'use client';

import { useState } from 'react';
import { X, Send } from 'lucide-react';

interface Comment {
  page: number;
  text: string;
}

interface CommentPanelProps {
  pageNumber: number;
  existingComment?: string;
  onClose: () => void;
  onSave: (comment: Comment) => void;
}

export default function CommentPanel({
  pageNumber,
  existingComment = '',
  onClose,
  onSave,
}: CommentPanelProps) {
  const [comment, setComment] = useState(existingComment);

  const handleSave = () => {
    if (comment.trim()) {
      onSave({ page: pageNumber, text: comment });
    }
    onClose();
  };

  const handleDelete = () => {
    onSave({ page: pageNumber, text: '' }); // Empty comment = delete
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[3px] shadow-xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Коментар до сторінки {pageNumber}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comment Input */}
        <div className="mb-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Напишіть ваш коментар або побажання щодо цієї сторінки..."
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-[3px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            autoFocus
          />
          <p className="mt-2 text-sm text-gray-500">
            Наприклад: "Більше відстані між фото", "Замінити це фото на інше", "Чудово, все подобається!"
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          {existingComment && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              Видалити коментар
            </button>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Скасувати
            </button>
            <button
              onClick={handleSave}
              disabled={!comment.trim()}
              className={`flex items-center gap-2 px-6 py-2 rounded-[3px] font-medium transition-colors ${
                comment.trim()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="h-4 w-4" />
              Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
