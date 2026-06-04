import {
    Html,
    Head,
    Body,
    Container,
    Section,
    Text,
    Button,
    Preview,
    Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface WinBackEmailProps {
    firstName?: string;
    promoCode?: string;
    discount?: string;
    appUrl?: string;
}

export default function WinBackEmail({
    firstName = '',
    promoCode = 'WINBACK10',
    discount = '-10%',
    appUrl = 'https://touchmemories.com.ua',
}: WinBackEmailProps) {
    const greeting = firstName ? `Привіт, ${firstName}!` : 'Привіт!';

    return (
        <Html>
            <Head />
            <Preview>Ми скучили! Ваша знижка на наступну фотокнигу всередині</Preview>
            <Tailwind>
                <Body className="bg-[#fffbeb] font-sans text-[#263A99] m-0 p-0">
                    <Container className="bg-white mx-auto my-[40px] max-w-[600px] overflow-hidden shadow-sm border border-[#fef3c7]">

                        <Section className="bg-[#fef3c7] py-[32px] text-center border-b border-[#fde68a]">
                            <Text className="text-[24px] font-black text-[#d97706] m-0 tracking-widest uppercase">
                                TouchMemories
                            </Text>
                        </Section>

                        <Section className="p-[40px]">
                            <Text className="text-[22px] font-bold text-[#263A99] mt-0 mb-[16px]">
                                {greeting}
                            </Text>

                            <Text className="text-[16px] leading-[26px] text-[#475569] mb-[24px]">
                                Давно вас не бачили — і встигли скучити. Можливо, назбиралися нові
                                фото, які варто зберегти у красивій фотокнизі чи журналі? Ми зробимо
                                все за вас, щоб спогади залишилися назавжди.
                            </Text>

                            <Text className="text-[16px] leading-[26px] text-[#475569] mb-[32px]">
                                Щоб повернутися було приємніше, даруємо вам знижку <strong>{discount}</strong> на
                                наступне замовлення:
                            </Text>

                            <Section className="bg-[#fffbeb] border border-[#fde68a] rounded-[3px] text-center py-[24px] mb-[32px]">
                                <Text className="text-[#d97706] font-bold text-[14px] m-0 uppercase tracking-wide mb-[8px]">
                                    Ваш промокод
                                </Text>
                                <Text className="text-[#263A99] font-black text-[28px] m-0 tracking-widest">
                                    {promoCode}
                                </Text>
                            </Section>

                            <Section className="text-center mb-[32px]">
                                <Button
                                    href={appUrl}
                                    className="bg-[#263A99] text-white font-bold text-[16px] px-[32px] py-[14px] rounded-[3px] no-underline"
                                >
                                    Обрати фотокнигу
                                </Button>
                            </Section>

                            <Text className="text-[13px] leading-[22px] text-[#94a3b8] m-0">
                                Якщо більше не хочете отримувати такі листи — просто дайте нам знати у
                                відповідь на цей лист або напишіть на hello@touchmemories.com.ua.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
