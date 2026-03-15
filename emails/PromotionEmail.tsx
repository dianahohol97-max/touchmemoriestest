import {
    Html,
    Head,
    Body,
    Container,
    Section,
    Text,
    Button,
    Img,
    Row,
    Column,
    Preview,
    Tailwind
} from '@react-email/components';
import * as React from 'react';

interface PromotionEmailProps {
    title: string;
    previewText: string;
    heroImageUrl?: string;
    bodyText: string;
    promoCode?: string;
    promoValue?: string;
    promoDetails?: string;
    appUrl: string;
    products?: {
        name: string;
        price: string;
        imageUrl: string;
        url: string;
    }[];
}

export default function PromotionEmail({
    title = 'Спеціальна Пропозиція До Дня Матері 🌸',
    previewText = 'Час обирати подарунки з нашою новою акцією',
    heroImageUrl = 'https://images.unsplash.com/photo-1516961642265-531546e84af2?q=80&w=1200&auto=format&fit=crop',
    bodyText = 'Збережіть найтепліші моменти з найріднішими. Ми підготували для вас чудову можливість створити фотокнигу, яка збереже ваші спогади назавжди.',
    promoCode = 'MOM2024',
    promoValue = '-15%',
    promoDetails = 'на всі преміум фотокниги до 15 травня',
    appUrl = 'https://touchmemories.ua',
    products = [
        {
            name: 'Сімейна Фотокнига',
            price: 'Від 850 грн',
            imageUrl: 'https://images.unsplash.com/photo-1544377193-33dcf4d68fb5?q=80&w=600&auto=format&fit=crop',
            url: 'https://touchmemories.ua/products/family'
        },
        {
            name: 'Insta-бук',
            price: 'Від 400 грн',
            imageUrl: 'https://images.unsplash.com/photo-1510565809774-4b5cb3dbb7ab?q=80&w=600&auto=format&fit=crop',
            url: 'https://touchmemories.ua/products/insta'
        }
    ]
}: PromotionEmailProps) {
    return (
        <Html>
            <Head />
            {previewText && <Preview>{previewText}</Preview>}
            <Tailwind>
                <Body className="bg-[#f1f5f9] font-sans text-[#263A99] m-0 p-0">
                    <Container className="bg-white mx-auto my-[40px] max-w-[600px] rounded-xl overflow-hidden shadow border border-[#e2e8f0]">

                        {/* Hero Image */}
                        {heroImageUrl && (
                            <Section>
                                <Img src={heroImageUrl} width="600" height="auto" alt={title} className="w-full object-cover max-h-[300px]" />
                            </Section>
                        )}

                        <Section className="p-[40px] text-center">
                            <Text className="text-[28px] font-black text-[#263A99] mt-0 mb-[16px] leading-[34px]">
                                {title}
                            </Text>

                            <Text className="text-[16px] leading-[26px] text-[#475569] mb-[32px]">
                                {bodyText}
                            </Text>

                            {/* Promo Code Block */}
                            {promoCode && (
                                <Section className="bg-[#f8fafc] border-2 border-dashed border-[#cbd5e1] rounded-xl py-[24px] px-[16px] mb-[32px]">
                                    {promoValue && (
                                        <Text className="text-[32px] font-black text-[#263A99] m-0 leading-none">
                                            {promoValue}
                                        </Text>
                                    )}
                                    <Text className="text-[#64748b] text-[14px] mt-[12px] mb-[8px]">
                                        Ваш промокод:
                                    </Text>
                                    <Text className="text-[20px] font-mono font-bold text-[#263A99] bg-white border border-[#e2e8f0] inline-block px-[16px] py-[8px] rounded m-0 tracking-widest">
                                        {promoCode}
                                    </Text>
                                    {promoDetails && (
                                        <Text className="text-[12px] text-[#94a3b8] mt-[12px] mb-0">
                                            *{promoDetails}
                                        </Text>
                                    )}
                                </Section>
                            )}

                            {/* CTA */}
                            <Button
                                href={appUrl}
                                className="bg-[#263A99] text-white px-[32px] py-[16px] rounded-lg text-[16px] font-bold no-underline inline-block w-full max-w-[300px]"
                            >
                                Перейти в каталог →
                            </Button>
                        </Section>

                        {/* Optional Products Grid */}
                        {products && products.length > 0 && (
                            <Section className="bg-[#f8fafc] p-[40px] border-t border-[#f1f5f9]">
                                <Text className="text-center font-bold text-[18px] mb-[24px] text-[#263A99]">
                                    Акційні пропозиції
                                </Text>
                                <Row>
                                    {products.map((p, i) => (
                                        <Column key={i} className={`w-1/2 ${i % 2 === 0 ? 'pr-[8px]' : 'pl-[8px]'}`}>
                                            <div className="bg-white rounded-lg p-[16px] shadow-sm border border-[#f1f5f9] mb-[16px]">
                                                <Img src={p.imageUrl} alt={p.name} className="w-full h-[160px] object-cover rounded mb-[16px]" />
                                                <Text className="font-bold text-[15px] m-0 text-[#263A99] leading-tight mb-[4px]">
                                                    {p.name}
                                                </Text>
                                                <Text className="text-[14px] text-[#64748b] m-0 font-semibold mb-[16px]">
                                                    {p.price}
                                                </Text>
                                                <Button href={p.url} className="bg-[#f1f5f9] text-[#263A99] border border-[#e2e8f0] text-[13px] font-bold px-[12px] py-[8px] rounded block text-center no-underline w-full">
                                                    Переглянути
                                                </Button>
                                            </div>
                                        </Column>
                                    ))}
                                </Row>
                            </Section>
                        )}

                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
