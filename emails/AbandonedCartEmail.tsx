import {
    Html,
    Head,
    Body,
    Container,
    Section,
    Text,
    Button,
    Row,
    Column,
    Img,
    Preview,
    Tailwind,
} from '@react-email/components';
import * as React from 'react';
import { BodyParagraphs } from './BodyParagraphs';


interface CartItem {
    name: string;
    qty?: number;
    price?: number;
    image?: string;
}

interface AbandonedCartEmailProps {
    body?: string;

    firstName?: string;
    items?: CartItem[];
    total?: number;
    currency?: string;
    appUrl?: string;
}

export default function AbandonedCartEmail({
    firstName = '',
    body,

    items = [],
    total = 0,
    currency = 'UAH',
    appUrl = 'https://touchmemories.com.ua',
}: AbandonedCartEmailProps) {
    const greeting = firstName ? `Привіт, ${firstName}!` : 'Привіт!';
    const cur = currency === 'UAH' ? 'грн' : currency;

    return (
        <Html>
            <Head />
            <Preview>Ваш кошик чекає — завершіть замовлення в кілька кліків</Preview>
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

                            {body ? (
                                <BodyParagraphs text={body} className="text-[16px] leading-[26px] text-[#475569] mb-[24px]" />
                            ) : (
                            <Text className="text-[16px] leading-[26px] text-[#475569] mb-[24px]">
                                Ви залишили у кошику кілька гарних речей — ми зберегли їх для вас.
                                Завершіть замовлення, поки вони на місці, і ми зробимо все, щоб ваші
                                спогади виглядали бездоганно.
                            </Text>
                            )}

                            <Section className="border border-[#fde68a] rounded-[3px] mb-[28px]">
                                {items.slice(0, 8).map((it, idx) => (
                                    <Row key={idx} className={idx > 0 ? 'border-t border-[#fef3c7]' : ''}>
                                        {it.image ? (
                                            <Column className="w-[64px] p-[10px]">
                                                <Img src={it.image} width="56" height="56" alt={it.name} className="rounded-[3px] object-cover" />
                                            </Column>
                                        ) : null}
                                        <Column className="p-[10px]">
                                            <Text className="text-[14px] font-semibold text-[#263A99] m-0">{it.name}</Text>
                                            <Text className="text-[13px] text-[#94a3b8] m-0">
                                                {(it.qty || 1)} × {Math.round(it.price || 0)} {cur}
                                            </Text>
                                        </Column>
                                    </Row>
                                ))}
                            </Section>

                            {total > 0 ? (
                                <Text className="text-[16px] font-bold text-[#263A99] mb-[24px]">
                                    Разом: {Math.round(total)} {cur}
                                </Text>
                            ) : null}

                            <Section className="text-center mb-[8px]">
                                <Button
                                    href={`${appUrl}/cart`}
                                    className="bg-[#263A99] text-white font-bold text-[16px] px-[32px] py-[14px] rounded-[3px] no-underline"
                                >
                                    Повернутися до кошика
                                </Button>
                            </Section>

                            <Text className="text-[13px] leading-[22px] text-[#94a3b8] mt-[24px] mb-0">
                                Якщо більше не хочете отримувати такі листи — просто напишіть нам на
                                hello@touchmemories.com.ua.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
