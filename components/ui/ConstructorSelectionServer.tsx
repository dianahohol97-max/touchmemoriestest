import { getAdminClient } from '@/lib/supabase/admin';
import { ConstructorSelectionClient } from './ConstructorSelectionClient';

export async function ConstructorSelectionServer({ locale = "uk" }: { locale?: string } = {}) {
    const supabase = getAdminClient();

    // Fetch section content for constructor selection
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'constructor_selection')
        .eq('is_active', true)
        .maybeSingle();

    if (sectionData && locale !== 'uk') {
        const trans = (sectionData as any).translations?.[locale];
        if (trans) {
            if (trans.heading) (sectionData as any).heading = trans.heading;
            if (trans.subheading) (sectionData as any).subheading = trans.subheading;
            if (trans.body) (sectionData as any).body_text = trans.body;
            if (trans.cta_text) (sectionData as any).cta_text = trans.cta_text;
            // Apply metadata translations (photobooks/magazines sections)
            const md = (sectionData as any).metadata || {};
            if (trans.photobooks_heading && md.photobooks) md.photobooks.heading = trans.photobooks_heading;
            if (trans.photobooks_description && md.photobooks) md.photobooks.description = trans.photobooks_description;
            if (trans.photobooks_constructor_btn && md.photobooks) md.photobooks.constructor_button_text = trans.photobooks_constructor_btn;
            if (trans.photobooks_designer_btn && md.photobooks) md.photobooks.designer_button_text = trans.photobooks_designer_btn;
            if (trans.magazines_heading && md.magazines) md.magazines.heading = trans.magazines_heading;
            if (trans.magazines_description && md.magazines) md.magazines.description = trans.magazines_description;
            if (trans.magazines_constructor_btn && md.magazines) md.magazines.constructor_button_text = trans.magazines_constructor_btn;
            if (trans.magazines_designer_btn && md.magazines) md.magazines.designer_button_text = trans.magazines_designer_btn;
            (sectionData as any).metadata = md;
        }
    }
    return <ConstructorSelectionClient sectionContent={sectionData || undefined} />;
}
