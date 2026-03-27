import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yivfsicvaoewxrtkrfxr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpdmZzaWN2YW9ld3hydGtyZnhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwOTMwMzQwMCwiZXhwIjoyMDI0ODc5NDAwfQ.KqVfZl_vN3JN6jZHp5v0TZ8vQYZ3RzQZ8RJwY0sVJGo';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🚀 Seeding database with missing data...\n');

// Since tables might not exist, we'll try to insert and catch errors
// If tables don't exist, we need to run migrations via Supabase Dashboard

async function seedHeroButtons() {
    console.log('📌 Seeding hero_buttons...');

    const buttons = [
        { button_text: 'Фотокнига', button_url: '/catalog?category=photobooks', display_order: 1, row_number: 1, is_active: true },
        { button_text: 'Глянцевий журнал', button_url: '/catalog?category=magazines', display_order: 2, row_number: 1, is_active: true },
        { button_text: 'Журнал з твердою обкладинкою', button_url: '/catalog?category=photojournal', display_order: 3, row_number: 2, is_active: true },
        { button_text: 'Тревелбук', button_url: '/catalog?category=travelbooks', display_order: 4, row_number: 2, is_active: true },
        { button_text: 'Фотодрук', button_url: '/catalog?category=prints', display_order: 5, row_number: 3, is_active: true },
        { button_text: 'Фотомагніти', button_url: '/catalog?category=photomagnets', display_order: 6, row_number: 3, is_active: true }
    ];

    const { data, error } = await supabase.from('hero_buttons').upsert(buttons, { onConflict: 'button_text' });

    if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        if (error.message.includes('does not exist')) {
            console.log('   ⚠️  Table does not exist! Run migrations first.');
        }
    } else {
        console.log(`   ✅ Inserted ${buttons.length} hero buttons`);
    }
}

async function seedFeatureCards() {
    console.log('📌 Seeding why_choose_us_cards...');

    const cards = [
        { title: 'Преміум якість друку', description: 'Fujicolor Crystal Archive, термін зберігання 100+ років', display_order: 1, is_active: true },
        { title: 'Персональний дизайн', description: 'Безкоштовний макет у подарунок, необмежені правки', display_order: 2, is_active: true },
        { title: 'Доступні ціни', description: 'Якісний друк за чесною ціною', display_order: 3, is_active: true },
        { title: 'Понад 20 000 задоволених клієнтів', description: 'Нам довіряють свої найдорожчі спогади', display_order: 4, is_active: true }
    ];

    const { data, error} = await supabase.from('why_choose_us_cards').upsert(cards, { onConflict: 'title' });

    if (error) {
        console.log(`   ❌ Error: ${error.message}`);
    } else {
        console.log(`   ✅ Inserted ${cards.length} feature cards`);
    }
}

async function seedNavigationLinks() {
    console.log('📌 Seeding navigation_links...');

    const links = [
        { link_text: 'Фотокниги', link_url: '/catalog?category=photobooks', display_order: 1, is_active: true, parent_id: null },
        { link_text: 'Журнали', link_url: '/catalog?category=magazines', display_order: 2, is_active: true, parent_id: null },
        { link_text: 'Travel Book', link_url: '/catalog?category=travelbooks', display_order: 3, is_active: true, parent_id: null },
        { link_text: 'Фотодрук', link_url: '/catalog?category=prints', display_order: 4, is_active: true, parent_id: null },
        { link_text: 'Постери', link_url: '/catalog?category=posters', display_order: 5, is_active: true, parent_id: null },
        { link_text: 'Книга побажань', link_url: '/catalog?category=wishbook', display_order: 6, is_active: true, parent_id: null }
    ];

    const { data, error } = await supabase.from('navigation_links').upsert(links, { onConflict: 'link_text' });

    if (error) {
        console.log(`   ❌ Error: ${error.message}`);
    } else {
        console.log(`   ✅ Inserted ${links.length} navigation links`);
    }
}

async function seedFooterSections() {
    console.log('📌 Seeding footer_sections...');

    const sections = [
        { section_name: 'products', section_title: 'Продукти', display_order: 1, is_active: true },
        { section_name: 'help', section_title: 'Допомога', display_order: 2, is_active: true },
        { section_name: 'contacts', section_title: 'Контакти', display_order: 3, is_active: true }
    ];

    const { data, error } = await supabase.from('footer_sections').upsert(sections, { onConflict: 'section_name' });

    if (error) {
        console.log(`   ❌ Error: ${error.message}`);
    } else {
        console.log(`   ✅ Inserted ${sections.length} footer sections`);
        return data;
    }
}

async function seedFooterLinks() {
    console.log('📌 Seeding footer_links...');

    // Get section IDs first
    const { data: sections } = await supabase.from('footer_sections').select('id, section_name');

    if (!sections || sections.length === 0) {
        console.log('   ⚠️  No footer sections found, skipping links');
        return;
    }

    const productsId = sections.find(s => s.section_name === 'products')?.id;
    const helpId = sections.find(s => s.section_name === 'help')?.id;
    const contactsId = sections.find(s => s.section_name === 'contacts')?.id;

    const links = [
        // Products
        { section_id: productsId, link_text: 'Фотокниги', link_url: '/catalog?category=photobooks', display_order: 1, is_active: true },
        { section_id: productsId, link_text: 'Журнали', link_url: '/catalog?category=magazines', display_order: 2, is_active: true },
        { section_id: productsId, link_text: 'Фотодрук', link_url: '/catalog?category=prints', display_order: 3, is_active: true },

        // Help
        { section_id: helpId, link_text: 'Доставка та оплата', link_url: '/delivery', display_order: 1, is_active: true },
        { section_id: helpId, link_text: 'Питання та відповіді', link_url: '/faq', display_order: 2, is_active: true },
        { section_id: helpId, link_text: 'Конструктор', link_url: '/editor', display_order: 3, is_active: true },

        // Contacts
        { section_id: contactsId, link_text: 'touch.memories3@gmail.com', link_url: 'mailto:touch.memories3@gmail.com', display_order: 1, is_active: true },
        { section_id: contactsId, link_text: 'Тернопіль, вул. Київська 2', link_url: '#', display_order: 2, is_active: true },
        { section_id: contactsId, link_text: 'Telegram', link_url: 'https://t.me/touchmemories', display_order: 3, is_active: true },
        { section_id: contactsId, link_text: 'Instagram', link_url: 'https://instagram.com/touchmemories', display_order: 4, is_active: true }
    ];

    const { data, error } = await supabase.from('footer_links').insert(links);

    if (error) {
        console.log(`   ❌ Error: ${error.message}`);
    } else {
        console.log(`   ✅ Inserted ${links.length} footer links`);
    }
}

async function updateSiteContent() {
    console.log('📌 Updating site_content...');

    const updates = [
        { key: 'hero_title', value: 'Доторкніться до спогадів' },
        { key: 'hero_subtitle', value: 'Створено з любов\'ю' },
        { key: 'footer_address', value: 'Тернопіль, вул. Київська 2' },
        { key: 'footer_email', value: 'touch.memories3@gmail.com' }
    ];

    for (const update of updates) {
        const { error } = await supabase
            .from('site_content')
            .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });

        if (error) {
            console.log(`   ❌ Error updating ${update.key}: ${error.message}`);
        } else {
            console.log(`   ✅ Updated ${update.key}`);
        }
    }
}

// Run all seed functions
async function main() {
    await seedHeroButtons();
    await seedFeatureCards();
    await seedNavigationLinks();
    await seedFooterSections();
    await seedFooterLinks();
    await updateSiteContent();

    console.log('\n✅ Database seeding complete!\n');
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
});
