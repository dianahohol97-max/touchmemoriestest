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

interface WelcomeEmailProps {
    firstName?: string;
    promoCode: string;
    appUrl: string;
}

export default function WelcomeEmail({
    firstName = '',
    promoCode = 'WELCOME10',
    appUrl = 'https://touchmemories.ua'
}: WelcomeEmailProps) {
    const greeting = firstName ? `Привіт, ${firstName}! 👋` : 'Привіт! 👋';

    return (
        <Html>
            <Head />
            <Preview>Раді вітати вас в TouchMemories! Ваш подарунок всередині 🎁</Preview>
            <Tailwind>
                <Body className="bg-[#fffbeb] font-sans text-[#334155] m-0 p-0">
                    <Container className="bg-white mx-auto my-[40px] max-w-[600px] overflow-hidden shadow-sm border border-[#fef3c7]">

                        {/* Header Image or Minimal Logo Area */}
                        <Section className="bg-[#fef3c7] py-[32px] text-center border-b border-[#fde68a]">
                            <Text className="text-[24px] font-black text-[#d97706] m-0 tracking-widest uppercase">
                                TouchMemories
                            </Text>
                        </Section>

                        {/* Content */}
                        <Section className="p-[40px]">
                            <Text className="text-[22px] font-bold text-[#1e293b] mt-0 mb-[16px]">
                                {greeting}
                            </Text>

                            <Text className="text-[16px] leading-[26px] text-[#475569] mb-[24px]">
                                Дякуємо, що приєдналися до нашої спільноти! Ми обожнюємо зберігати важливі моменти у вигляді естетичних фотокниг.
                                Тепер ви першими дізнаватиметеся про наші новинки, натхнення та закриті розпродажі.
                            </Text>

                            <Text className="text-[16px] leading-[26px] text-[#475569] mb-[32px]">
                                Як і обіцяли, даруємо вам знижку <strong>-10%</strong> на ваше перше замовлення:
                            </Text>

                            {/* Promo Block */}
                            <Section className="bg-[#fffbeb] border border-[#fde68a] rounded-xl text-center py-[24px] mb-[32px]">
                                <Text className="text-[#d97706] font-bold text-[14px] m-0 uppercase tracking-wide mb-[8px]">
                                    Промокод на перше замовлення
                                </Text>
                                <div className="bg-white border border-[#fcd34d] inline-block px-[24px] py-[12px] rounded-lg mt-[4px]">
                                    <Text className="text-[24px] font-mono font-black text-[#d97706] m-0 tracking-widest">
                                        {promoCode}
                                    </Text>
                                </div>
                            </Section>

                            {/* Info Steps */}
                            <Section className="mb-[40px]">
                                <Text className="font-bold text-[18px] text-[#1e293b] mb-[16px]">
                                    Що далі?
                                </Text>

                                <div className="mb-[16px]">
                                    <Text className="m-0 font-bold text-[#334155]">1. Оберіть формат 📏</Text>
                                    <Text className="m-0 text-[#64748b] text-[14px]">Від компактного insta-формату до великих сімейних альбомів.</Text>
                                </div>
                                <div className="mb-[16px]">
                                    <Text className="m-0 font-bold text-[#334155]">2. Завантажте фото 📸</Text>
                                    <Text className="m-0 text-[#64748b] text-[14px]">Використовуйте наш зручний онлайн-конструктор прямо в браузері.</Text>
                                </div>
                                <div>
                                    <Text className="m-0 font-bold text-[#334155]">3. Отримайте шедевр 🚚</Text>
                                    <Text className="m-0 text-[#64748b] text-[14px]">Ми надрукуємо і відправимо вашу книгу в подарунковій упаковці.</Text>
                                </div>
                            </Section>

                            {/* CTA */}
                            <Section className="text-center mb-[24px]">
                                <Button
                                    href={`${appUrl}/book-constructor`}
                                    className="bg-[#d97706] text-white px-[32px] py-[16px] rounded-lg text-[16px] font-bold no-underline w-full max-w-[280px]"
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
