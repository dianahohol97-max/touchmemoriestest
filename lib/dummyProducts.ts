export interface Product {
    id: string;
    name: string;
    slug: string;
    price: number;
    category: {
        id: string;
        name: string;
        slug: string;
    };
    short_description: string;
    description: string;
    images: string[];
    is_active: boolean;
    format_options?: string[];
    cover_options?: string[];
    min_pages?: number;
    max_pages?: number;
}

export const dummyProducts: Product[] = [
    // Фотокниги (3-4)
    {
        id: 'pb-1',
        name: 'Класична Фотокнига',
        slug: 'classic-photobook',
        price: 899,
        category: { id: 'cat-pb', name: 'Фотокниги', slug: 'photobooks' },
        short_description: 'Преміальний друк, тверда обкладинка, розкриття на 180 градусів.',
        description: '<p>Збережіть найкращі моменти вашого життя у класичному форматі. Тверда палітурка надійно захистить сторінки, а матовий папір преміум-класу підкреслить кожну деталь ваших фото.</p><ul><li>Щільність сторінок: 400 г/м²</li><li>Розворот на 180 градусів без розриву зображення</li><li>Кастомний дизайн обкладинки</li></ul>',
        images: ['https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
        format_options: ['20x20 см', '30x30 см', 'A4'],
        cover_options: ['Тверда фотообкладинка', 'Екошкіра'],
        min_pages: 20,
        max_pages: 100,
    },
    {
        id: 'pb-2',
        name: 'Весільна Фотокнига',
        slug: 'wedding-photobook',
        price: 1499,
        category: { id: 'cat-pb', name: 'Фотокниги', slug: 'photobooks' },
        short_description: 'Ексклюзивні матеріали, обкладинка з велюру або екошкіри.',
        description: '<p>Створена для найголовнішого дня. Вишукана обкладинка матеріалів на вибір (велюр, льон, або італійська екошкіра). Надруковано на щільному шовковому папері.</p>',
        images: ['https://images.unsplash.com/photo-1522856339183-5a981615f5fc?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
        format_options: ['30x30 см'],
        cover_options: ['Велюр', 'Екошкіра', 'Льон'],
        min_pages: 30,
        max_pages: 80,
    },
    {
        id: 'pb-3',
        name: 'Дитяча Фотокнига',
        slug: 'kids-photobook',
        price: 649,
        category: { id: 'cat-pb', name: 'Фотокниги', slug: 'photobooks' },
        short_description: 'Яскраві дизайни та надійні сторінки, яким не страшні дитячі ручки.',
        description: '<p>Створіть казку про перший рік життя вашого малюка! Спеціальне ламінування сторінок захищає їх від забруднень.</p>',
        images: ['https://images.unsplash.com/photo-1519689680058-324335c77eba?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
        format_options: ['20x20 см', 'A4'],
        cover_options: ['Тверда глянцева', 'Тверда матова'],
        min_pages: 20,
        max_pages: 50,
    },
    {
        id: 'pb-4',
        name: 'Міні-бук (Insta-формат)',
        slug: 'mini-photobook',
        price: 399,
        category: { id: 'cat-pb', name: 'Фотокниги', slug: 'photobooks' },
        short_description: 'Компактний формат для фотографій з соціальних мереж.',
        description: '<p>Маленька книга великих емоцій. Ідеально підходить для друку фотографій з Instagram.</p>',
        images: ['https://images.unsplash.com/photo-1589839955375-920accd2a488?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
        format_options: ['15x15 см'],
        cover_options: ['М\'яка'],
        min_pages: 24,
        max_pages: 40,
    },

    // Тревелбук (2)
    {
        id: 'tb-1',
        name: 'Travel Book "Європа"',
        slug: 'travel-book-europe',
        price: 799,
        category: { id: 'cat-tb', name: 'Тревелбук', slug: 'travelbook' },
        short_description: 'Збережи спогади про кожне місто, в якому побував.',
        description: '<p>Тематичний шаблон для ваших подорожей Європою. Спеціальні розвороти для квитків та нотаток.</p>',
        images: ['https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=800&auto=format&fit=crop', 'https://images.unsplash.com/photo-1476900543704-4312b78632f8?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
        format_options: ['A4 горізонтальний'],
        cover_options: ['Тверда'],
        min_pages: 30,
        max_pages: 60,
    },
    {
        id: 'tb-2',
        name: 'Тревелбук "Карпати"',
        slug: 'travel-book-karpaty',
        price: 749,
        category: { id: 'cat-tb', name: 'Тревелбук', slug: 'travelbook' },
        short_description: 'Атмосферний фотобук для походів та гірських пейзажів.',
        description: '<p>Спеціальний дизайн для ваших мандрівок на природу. Натуральні текстури на сторінках.</p>',
        images: ['https://images.unsplash.com/photo-1513026705753-bc3fffca8bf4?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
        format_options: ['A4 горізонтальний', '20x20 см'],
        cover_options: ['Тверда матова'],
    },

    // Настінний журнал (2)
    {
        id: 'mag-1',
        name: 'Глянцевий Журнал (Стандарт)',
        slug: 'magazine-standard',
        price: 450,
        category: { id: 'cat-mag', name: 'Настінний журнал', slug: 'magazines' },
        short_description: 'Будь на обкладинці власного журналу!',
        description: '<p>Стильний формат у вигляді справжнього глянцевого журналу. М\'яка обкладинка та журнальний папір.</p>',
        images: ['https://images.unsplash.com/photo-1549488344-c119c6fb4e77?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
    },
    {
        id: 'mag-2',
        name: 'Весільний Журнал',
        slug: 'wedding-magazine',
        price: 550,
        category: { id: 'cat-mag', name: 'Настінний журнал', slug: 'magazines' },
        short_description: 'Оригінальний спосіб розказати історію вашого кохання.',
        description: '<p>Подаруйте вашим гостям або залиште собі на згадку вашу історію у форматі глянцю!</p>',
        images: ['https://images.unsplash.com/photo-1606214174585-f2f47ee2d708?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
    },

    // Фотодрук (2)
    {
        id: 'print-1',
        name: 'Набір Polaroid (24 шт)',
        slug: 'polaroid-set',
        price: 299,
        category: { id: 'cat-print', name: 'Фотодрук', slug: 'photo-print' },
        short_description: 'Атмосферні ретро-фото розміру 10х10 см з білою рамкою.',
        description: '<p>Стильні фото в стилі Polaroid. Супер для мудбордів або гірлянд.</p>',
        images: ['https://images.unsplash.com/photo-1502444330042-d1a1ddf9d779?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
    },
    {
        id: 'print-2',
        name: 'Друк фотографій 10x15',
        slug: 'prints-10x15',
        price: 5,
        category: { id: 'cat-print', name: 'Фотодрук', slug: 'photo-print' },
        short_description: 'Класичний якісний друк ваших фото. Мінімальне замовлення 50 шт.',
        description: '<p>Друк на професійному фотопапері.</p>',
        images: ['https://images.unsplash.com/photo-1603513492128-ba7bc9b3e143?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
    },

    // Сертифікати (1)
    {
        id: 'cert-1',
        name: 'Подарунковий Сертифікат',
        slug: 'gift-card',
        price: 1000,
        category: { id: 'cat-cert', name: 'Сертифікати', slug: 'certificates' },
        short_description: 'Найкращий подарунок - це емоції! Сертифікати номіналом від 1000 до 5000 грн.',
        description: '<p>Подаруйте близьким можливість створити власну Фотокнигу. Наш сертифікат поставляється у стильному конверті.</p>',
        images: ['https://images.unsplash.com/photo-1510100486799-adddbd6364bf?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
    },

    // Інші товари (1)
    {
        id: 'oth-1',
        name: 'Дерев\'яний бокс для Фотокниги',
        slug: 'wood-box',
        price: 800,
        category: { id: 'cat-oth', name: 'Інші товари', slug: 'other' },
        short_description: 'Надійно зберігає ваші спогади багато років. Виготовлений з дуба.',
        description: '<p>Розкішний спосіб подарувати або зберігати вашу фотокнигу. Ручна робота.</p>',
        images: ['https://images.unsplash.com/photo-1590082695509-c12e52eecdd7?q=80&w=800&auto=format&fit=crop'],
        is_active: true,
    }
];
