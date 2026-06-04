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
import { BodyParagraphs } from './BodyParagraphs';


interface WelcomeSeriesEmailProps {
    firstName?: string;
    variant?: 'ideas' | 'reminder';
    promoCode?: string;
    discount?: string;
    appUrl?: string;
    body?: string;
}

export default function WelcomeSeriesEmail({
    firstName = '',
    variant = 'ideas',
    promoCode = 'WELCOME7',
    discount = '-7%',
    appUrl = 'https://touchmemories.com.ua',
    body,
}: WelcomeSeriesEmailProps) {
    const greeting = firstName ? `Привіт, ${firstName}!` : 'Привіт!';
    const isReminder = variant === 'reminder';

    const preview = isReminder
        ? `Ваш промокод ${promoCode} ще активний`
        : 'Ось що можна створити з ваших фото';

    return (
        <Html>
            <Head />
            <Preview>{preview}</Preview>
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

                            {isReminder ? (
                                <>
                                    {body ? (
                                        <BodyParagraphs text={body} className="text-[16px] leading-[26px] text-[#475569] mb-[24px]" />
                                    ) : (
                                    <Text className="text-[16px] leading-[26px] text-[#475569] mb-[24px]">
                                        Нагадуємо: ваш промокод на перше замовлення ще активний. Це чудова
                                        нагода зберегти найдорожчі моменти у красивій фотокнизі чи журналі —
                                        а ми подбаємо про все інше.
                                    </Text>
                                    )}
                                    <Section className="bg-[#fffbeb] border border-[#fde68a] rounded-[3px] text-center py-[24px] mb-[32px]">
                                        <Text className="text-[#d97706] font-bold text-[14px] m-0 uppercase tracking-wide mb-[8px]">
                                            Ваш промокод {discount}
                                        </Text>
                                        <Text className="text-[#263A99] font-black text-[28px] m-0 tracking-widest">
                                            {promoCode}
                                        </Text>
                                    </Section>
                                </>
                            ) : (
                                <>
                                    {body ? (
                                        <BodyParagraphs text={body} className="text-[16px] leading-[26px] text-[#475569] mb-[24px]" />
                                    ) : (
                                    <>
                                    <Text className="text-[16px] leading-[26px] text-[#475569] mb-[24px]">
                                        Дякуємо, що з нами! Поки ви обираєте, ось кілька ідей, що можна
                                        створити зі своїх фото:
                                    </Text>
                                    <Section className="mb-[28px]">
                                        <Text className="text-[15px] leading-[24px] text-[#475569] m-0 mb-[10px]">
                                            • <strong>Фотокнига</strong> — найкращі моменти року в одному виданні.
                                        </Text>
                                        <Text className="text-[15px] leading-[24px] text-[#475569] m-0 mb-[10px]">
                                            • <strong>Глянцевий журнал</strong> — стильний формат для особливих подій.
                                        </Text>
                                        <Text className="text-[15px] leading-[24px] text-[#475569] m-0 mb-[10px]">
                                            • <strong>Тревелбук</strong> — спогади про подорожі, які хочеться гортати.
                                        </Text>
                                        <Text className="text-[15px] leading-[24px] text-[#475569] m-0">
                                            • <strong>Постери та фотомагніти</strong> — теплі дрібниці для дому.
                                        </Text>
                                    </Section>
                                    </>
                                    )}
                                </>
                            )}

                            <Section className="text-center mb-[8px]">
                                <Button
                                    href={`${appUrl}/catalog`}
                                    className="bg-[#263A99] text-white font-bold text-[16px] px-[32px] py-[14px] rounded-[3px] no-underline"
                                >
                                    {isReminder ? 'Використати промокод' : 'Подивитися каталог'}
                                </Button>
                            </Section>

                            <Text className="text-[13px] leading-[22px] text-[#94a3b8] mt-[24px] mb-0">
                                Якщо більше не хочете отримувати такі листи — напишіть нам на
                                hello@touchmemories.com.ua.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
