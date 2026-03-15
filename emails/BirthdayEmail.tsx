import {
    Html,
    Head,
    Body,
    Container,
    Section,
    Text,
    Button,
    Img,
    Link,
    Preview,
    Tailwind
} from '@react-email/components';
import * as React from 'react';

interface BirthdayEmailProps {
    firstName: string;
    promoCode: string;
    validUntil: string;
    discountValue: string;
    appUrl: string;
}

export default function BirthdayEmail({
    firstName = 'Клієнт',
    promoCode = 'HAPPY-BDAY-20',
    validUntil = '7 днів',
    discountValue = '-20%',
    appUrl = 'https://touchmemories.ua'
}: BirthdayEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>З Днем Народження! Ваш особливий подарунок всередині 🎂</Preview>
            <Tailwind>
                <Body className="bg-[#f6f9fc] font-sans text-[#263A99] m-0 p-0">
                    <Container className="bg-white mx-auto my-[40px] max-w-[600px] rounded-[3px] overflow-hidden shadow-sm border border-[#e2e8f0]">

                        {/* Header Banner - Purple / Pink Gradient */}
                        <Section className="bg-gradient-to-r from-[#9333ea] to-[#ec4899] py-[40px] text-center">
                            <Text className="text-white text-[32px] font-bold m-0 tracking-tight">
                                З Днем Народження! 🎂
                            </Text>
                        </Section>

                        {/* Content */}
                        <Section className="p-[40px]">
                            <Text className="text-[18px] leading-[26px] mb-[24px]">
                                Іменнику/Іменниці <strong>{firstName}</strong>,
                                <br /><br />
                                Від щирого серця вітаємо вас! Бажаємо безліч яскравих моментів, збережених у пам'яті.
                                Щоб зробити цей день ще особливішим, ми підготували для вас подарунок!
                            </Text>

                            {/* Promo Block */}
                            <Section className="bg-[#fdf2f8] border border-[#fbcfe8] rounded-[3px] text-center py-[32px] my-[32px]">
                                <Text className="text-[#ec4899] font-bold text-[16px] m-0 uppercase tracking-widest mb-[8px]">
                                    Ваша знижка на будь-яке замовлення
                                </Text>
                                <Text className="text-[48px] font-black text-[#263A99] my-0 leading-none">
                                    {discountValue}
                                </Text>
                                <Text className="text-[14px] text-[#64748b] mt-[16px] mb-0">
                                    Ваш персональний промокод:
                                </Text>
                                <div className="bg-white border-2 border-dashed border-[#ec4899] inline-block px-[24px] py-[12px] rounded-[3px] mt-[12px]">
                                    <Text className="text-[20px] font-mono font-bold text-[#ec4899] m-0 tracking-widest">
                                        {promoCode}
                                    </Text>
                                </div>
                                <Text className="text-[12px] text-[#94a3b8] mt-[16px] mb-0">
                                    *Діє до {validUntil} при замовленні від 500 грн
                                </Text>
                            </Section>

                            {/* CTA */}
                            <Section className="text-center mt-[32px]">
                                <Button
                                    href={`${appUrl}`}
                                    className="bg-[#263A99] text-white px-[32px] py-[16px] rounded-[3px] text-[16px] font-bold no-underline"
                                >
                                    Створити фотокнигу зі знижкою →
                                </Button>
                            </Section>

                            <Text className="text-[15px] leading-[24px] text-[#64748b] mt-[40px] border-t border-[#f1f5f9] pt-[24px]">
                                Теплі обійми,<br />
                                Команда TouchMemories ✨
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
