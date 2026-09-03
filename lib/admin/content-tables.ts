/**
 * Таблиці контенту, які редагуються з адмінки, і те, чим саме їх можна
 * редагувати.
 *
 * Навіщо реєстр, а не роут на кожну таблицю. Дев'ять сторінок адмінки —
 * контент, дизайн сайту, блог, категорії блогу, відгуки, лендінги, шаблони
 * листів, категорії каталогу — писали в базу прямо з браузера, разом близько
 * сотні місць. Усі ці таблиці закриті політикою is_admin_user(), тобто «email
 * є в admin_users», куди входять четверо з чотирнадцяти активних
 * співробітників. Для решти запис мовчки не проходив: RLS не помилка, а нуль
 * зачеплених рядків, тож сторінка казала «Збережено» і не зберігала нічого.
 * Дизайнер, якому роль дає контент повністю, не міг зберегти жодної правки і
 * дізнавався про це тільки з перезавантаженої сторінки.
 *
 * Сотня окремих обробників на дев'ять сторінок була б сотнею місць, де можна
 * забути guard. Натомість один роут із явним білим списком: які таблиці
 * взагалі існують для нього, який розділ прав на них потрібен і які саме
 * колонки він погоджується записати. Усе, чого немає в списку, відхиляється
 * з 400 — це не «динамічний SQL», а перелік, який видно очима.
 *
 * Колонки навмисно перелічені руками, а не взяті зі схеми: id, created_at,
 * views_count і подібне сторінки не редагують, і випадково затерти їх
 * надісланим із браузера обʼєктом не має бути можливості.
 */

export interface ContentTable {
    /** Розділ прав: запис вимагає рівня edit, видалення — full. */
    section: string;
    /** Колонки, які роут погоджується записати. */
    columns: string[];
    /** Чи дозволено видаляти рядки цієї таблиці. */
    allowDelete: boolean;
    /** Стандартне сортування для читання. */
    orderBy?: { column: string; ascending?: boolean };
}

export const CONTENT_TABLES: Record<string, ContentTable> = {
    site_content: {
        section: 'content',
        columns: ['key', 'value', 'translations', 'updated_at'],
        allowDelete: false,
        orderBy: { column: 'key' },
    },
    site_blocks: {
        section: 'content',
        columns: ['block_name', 'is_visible', 'position_order', 'image_url', 'style_metadata', 'updated_at'],
        allowDelete: false,
        orderBy: { column: 'position_order' },
    },
    theme_settings: {
        section: 'content',
        columns: [
            'color_primary', 'color_secondary', 'color_accent', 'color_background', 'color_text',
            'font_family_heading', 'font_family_body', 'font_size_h1', 'font_size_h2', 'font_size_body',
            'border_radius', 'spacing_unit', 'button_border_radius',
            'button_text_primary', 'button_text_secondary', 'card_settings', 'updated_at',
        ],
        allowDelete: false,
    },
    section_content: {
        section: 'content',
        columns: [
            'section_name', 'heading', 'subheading', 'body_text', 'cta_text', 'cta_url',
            'image_url', 'metadata', 'is_active', 'translations', 'updated_at',
        ],
        allowDelete: true,
        orderBy: { column: 'section_name' },
    },
    hero_content: {
        section: 'content',
        columns: [
            'title', 'subtitle', 'overline_text', 'title_line1', 'title_line2',
            'cta_primary_text', 'cta_primary_url', 'cta_secondary_text', 'cta_secondary_url',
            'background_image', 'background_image_url', 'is_active', 'sort_order', 'translations', 'updated_at',
        ],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    hero_buttons: {
        section: 'content',
        columns: [
            'text', 'url', 'variant', 'button_text', 'button_url',
            'sort_order', 'display_order', 'row_number', 'is_active', 'translations',
        ],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    feature_cards: {
        section: 'content',
        columns: ['title', 'subtitle', 'icon', 'sort_order', 'is_active', 'translations'],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    footer_sections: {
        section: 'content',
        columns: ['section_name', 'section_title', 'display_order', 'is_active', 'translations'],
        allowDelete: true,
        orderBy: { column: 'display_order' },
    },
    footer_links: {
        section: 'content',
        columns: ['section_id', 'link_text', 'link_url', 'display_order', 'is_active', 'translations'],
        allowDelete: true,
        orderBy: { column: 'display_order' },
    },
    navigation_links: {
        section: 'content',
        columns: ['link_text', 'link_url', 'parent_id', 'display_order', 'is_active', 'translations'],
        allowDelete: true,
        orderBy: { column: 'display_order' },
    },
    faqs: {
        section: 'content',
        columns: ['question', 'answer', 'category', 'sort_order', 'is_active'],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    blog_posts: {
        section: 'content',
        columns: [
            'title', 'slug', 'category_id', 'author_name', 'author_avatar',
            'cover_image', 'cover_image_alt', 'excerpt', 'content', 'reading_time',
            'tags', 'keywords', 'related_product_ids', 'content_images', 'translations',
            'meta_title', 'meta_description', 'og_title',
            'is_published', 'is_featured', 'published_at', 'updated_at',
        ],
        allowDelete: true,
        orderBy: { column: 'created_at', ascending: false },
    },
    blog_categories: {
        section: 'content',
        columns: ['name', 'slug', 'description', 'sort_order', 'is_active', 'updated_at'],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    landing_pages: {
        section: 'content',
        columns: [
            'category_slug', 'occasion', 'kind', 'h1', 'intro',
            'meta_title', 'meta_description', 'product_slugs', 'hero_image',
            'is_active', 'sort_order', 'translations', 'faq', 'updated_at',
        ],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    reviews: {
        section: 'content',
        columns: [
            'image_url', 'video_url', 'media_type', 'caption', 'author', 'category',
            'rating', 'is_active', 'sort_order', 'product_id', 'status',
        ],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    reply_templates: {
        section: 'content',
        columns: ['name', 'subject', 'body', 'category', 'is_active', 'sort_order'],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    quiz_recommendations: {
        section: 'content',
        columns: ['q1_answer', 'q2_answers', 'product_ids', 'label', 'updated_at'],
        allowDelete: true,
        orderBy: { column: 'label' },
    },
    // Категорії каталогу — не контент, тож і розділ прав інший.
    categories: {
        section: 'catalog',
        columns: ['name', 'slug', 'description', 'cover_image', 'sort_order', 'is_active', 'display_style', 'translations'],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    gift_collections: {
        section: 'catalog',
        columns: ['name', 'slug', 'description', 'image_url', 'is_active', 'sort_order', 'label', 'label_uk', 'emoji', 'updated_at'],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
    gift_collection_items: {
        section: 'catalog',
        columns: ['collection_id', 'product_id', 'sort_order'],
        allowDelete: true,
        orderBy: { column: 'sort_order' },
    },
};

/** Лишає в обʼєкті лише дозволені колонки. Повертає й те, що відкинуло. */
export function pickColumns(
    table: ContentTable,
    input: unknown,
): { row: Record<string, unknown>; rejected: string[] } {
    const row: Record<string, unknown> = {};
    const rejected: string[] = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { row, rejected };
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        if (table.columns.includes(key)) row[key] = value;
        // id приходить у тілі як адреса рядка, а не як поле для запису —
        // мовчки пропускаємо, щоб не заважати сторінкам слати обʼєкт цілком.
        else if (key !== 'id') rejected.push(key);
    }
    return { row, rejected };
}
