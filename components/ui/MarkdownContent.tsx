import { renderMarkdown } from '@/lib/blog/markdown';

/**
 * Тіло статті, зібране на сервері.
 *
 * Свідомо НЕ клієнтський компонент: весь сенс у тому, щоб розмітка приходила
 * вже в першій відповіді сервера. Сусідній `MarkdownViewer` лишається для
 * юридичних сторінок, які рендеряться з клієнтського `LegalContent`.
 */
export default function MarkdownContent({ source, className }: { source: string; className?: string }) {
    const html = renderMarkdown(source);
    if (!html) return null;

    return (
        <div
            className={className ? `md-body ${className}` : 'md-body'}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
