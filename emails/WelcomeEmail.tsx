import {
    Html,
    Head,
    Body,
    Container,
    Section,
    Text,
    Button,
    Img,
    Preview,
    Tailwind
} from '@react-email/components';
import * as React from 'react';
import { BodyParagraphs } from './BodyParagraphs';


interface WelcomeEmailProps {
    firstName?: string;
    promoCode: string;
    discount?: string; // e.g. '7%' or '5%' — max per brand policy
    appUrl: string;
    body?: string;
}

export default function WelcomeEmail({
    firstName = '',
    promoCode = 'WELCOME7',
    discount = '7%',
    appUrl = 'https://touchmemories.com.ua',
    body,
}: WelcomeEmailProps) {
    const greeting = firstName ? `Привіт, ${firstName}! ` : 'Привіт! ';

    return (
        <Html>
            <Head />
            <Preview>Раді вітати вас в TouchMemories! Ваш подарунок всередині </Preview>
            <Tailwind>
                <Body className="bg-[#f1f5f9] font-sans text-[#263A99] m-0 p-0">
                    <Container className="bg-white mx-auto my-[40px] max-w-[600px] overflow-hidden shadow-sm border border-[#e2e8f0]">

                        {/* Brand header */}
                        <Section className="bg-[#263A99] py-[32px] text-center">
                            <Text className="text-[24px] font-black text-white m-0 tracking-widest uppercase">
                                TouchMemories
                            </Text>
                        </Section>

                        {/* Content */}
                        <Section className="p-[40px]">
                            <Text className="text-[22px] font-bold text-[#263A99] mt-0 mb-[16px]">
                                {greeting}
                            </Text>

                            {body ? (
                                <BodyParagraphs text={body} className="text-[16px] leading-[26px] text-[#475569] mb-[24px]" />
                            ) : (
                            <Text className="text-[16px] leading-[26px] text-[#475569] mb-[24px]">
                                Дякуємо, що приєдналися до нашої спільноти! Ми обожнюємо зберігати важливі моменти у вигляді естетичних фотокниг.
                                Тепер ви першими дізнаватиметеся про наші новинки, натхнення та закриті розпродажі.
                            </Text>
                            )}

                            <Text className="text-[16px] leading-[26px] text-[#475569] mb-[32px]">
                                Як і обіцяли, даруємо вам знижку <strong>-{discount}</strong> на ваше перше замовлення:
                            </Text>

                            {/* Promo Block */}
                            <Section className="bg-[#f5f7ff] border border-[#c7d2fe] rounded-[3px] text-center py-[24px] mb-[32px]">
                                <Text className="text-[#263A99] font-bold text-[14px] m-0 uppercase tracking-wide mb-[8px]">
                                    Промокод на перше замовлення
                                </Text>
                                <div className="bg-white border border-[#c7d2fe] inline-block px-[24px] py-[12px] rounded-[3px] mt-[4px]">
                                    <Text className="text-[24px] font-mono font-black text-[#263A99] m-0 tracking-widest">
                                        {promoCode}
                                    </Text>
                                </div>
                            </Section>

                            {/* Info Steps */}
                            <Section className="mb-[40px]">
                                <Text className="font-bold text-[18px] text-[#263A99] mb-[16px]">
                                    Що далі?
                                </Text>

                                <div className="mb-[16px]">
                                    <Text className="m-0 font-bold text-[#263A99]">1. Оберіть формат </Text>
                                    <Text className="m-0 text-[#64748b] text-[14px]">Від компактного insta-формату до великих сімейних альбомів.</Text>
                                </div>
                                <div className="mb-[16px]">
                                    <Text className="m-0 font-bold text-[#263A99]">2. Завантажте фото </Text>
                                    <Text className="m-0 text-[#64748b] text-[14px]">Використовуйте наш зручний онлайн-конструктор прямо в браузері.</Text>
                                </div>
                                <div>
                                    <Text className="m-0 font-bold text-[#263A99]">3. Отримайте шедевр </Text>
                                    <Text className="m-0 text-[#64748b] text-[14px]">Ми зберемо і відправимо вашу книгу в подарунковій упаковці.</Text>
                                </div>
                            </Section>

                            {/* CTA */}
                            <Section className="text-center mb-[24px]">
                                <Button
                                    href={`${appUrl}/constructor/photobook`}
                                    className="bg-[#263A99] text-white px-[32px] py-[16px] rounded-[3px] text-[16px] font-bold no-underline w-full max-w-[280px]"
                                >
                                    Створити фотокнигу →
                                </Button>
                            </Section>

                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
