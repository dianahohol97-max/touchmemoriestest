import {
    Html, Head, Body, Container, Section, Text, Button, Preview, Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface OrderCancelledEmailProps {
    customerName?: string;
    orderNumber?: string;
    orderTotal?: number;
    catalogUrl?: string;
}

export default function OrderCancelledEmail({
    customerName = '',
    orderNumber = '',
    orderTotal = 0,
    catalogUrl = 'https://touchmemories.com.ua/uk/catalog',
}: OrderCancelledEmailProps) {
    const firstName = customerName.split(' ')[0] || customerName;

    return (
        <Html lang="uk">
            <Head />
            <Preview>Замовлення {orderNumber} скасовано через несплату</Preview>
            <Tailwind>
                <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'sans-serif', margin: 0, padding: 0 }}>
                    <Container style={{ maxWidth: 560, margin: '40px auto', backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <Section style={{ backgroundColor: '#263A99', padding: '28px 32px' }}>
                            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '0.05em' }}>
                                TOUCH.MEMORIES
                            </Text>
                        </Section>

                        <Section style={{ padding: '32px 32px 24px' }}>
                            <Text style={{ fontSize: 22, fontWeight: 800, color: '#1e2d7d', margin: '0 0 16px' }}>
                                Замовлення скасовано
                            </Text>
                            <Text style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, margin: '0 0 12px' }}>
                                {firstName ? `${firstName}, ` : ''}ваше замовлення <strong>{orderNumber}</strong>
                                {orderTotal > 0 ? ` на суму ${orderTotal} ₴` : ''} було скасовано — ми не отримали оплату протягом 24 годин.
                            </Text>
                            <Text style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, margin: '0 0 28px' }}>
                                Нічого страшного! Ви можете оформити нове замовлення в будь-який час — усі ваші улюблені продукти нікуди не ділися.
                            </Text>

                            <Button
                                href={catalogUrl}
                                style={{
                                    backgroundColor: '#263A99',
                                    color: '#ffffff',
                                    padding: '14px 28px',
                                    borderRadius: 8,
                                    fontSize: 15,
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    display: 'inline-block',
                                }}
                            >
                                Перейти до каталогу →
                            </Button>
                        </Section>

                        <Section style={{ padding: '0 32px 32px' }}>
                            <Text style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                                Якщо у вас виникли питання — пишіть нам в{' '}
                                <a href="https://instagram.com/touch.memories" style={{ color: '#263A99' }}>Instagram</a>
                                {' '}або на{' '}
                                <a href="mailto:hello@touchmemories.com.ua" style={{ color: '#263A99' }}>hello@touchmemories.com.ua</a>
                            </Text>
                        </Section>

                        <Section style={{ backgroundColor: '#f8fafc', padding: '16px 32px', borderTop: '1px solid #e2e8f0' }}>
                            <Text style={{ fontSize: 12, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
                                © 2026 Touch.Memories · touchmemories.com.ua
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
