import {
    Html, Head, Body, Container, Section, Text, Button, Preview, Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface PaymentReminderEmailProps {
    customerName?: string;
    orderNumber?: string;
    orderTotal?: number;
    paymentUrl?: string;
    expiresInHours?: number;
}

export default function PaymentReminderEmail({
    customerName = '',
    orderNumber = '',
    orderTotal = 0,
    paymentUrl = '',
    expiresInHours = 20,
}: PaymentReminderEmailProps) {
    const firstName = customerName.split(' ')[0] || customerName;

    return (
        <Html lang="uk">
            <Head />
            <Preview>Нагадування: оплатіть замовлення {orderNumber}</Preview>
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
                                Ваше замовлення чекає на оплату
                            </Text>
                            <Text style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, margin: '0 0 8px' }}>
                                {firstName ? `${firstName}, н` : 'Н'}агадуємо: ваше замовлення <strong>{orderNumber}</strong>
                                {orderTotal > 0 ? ` на суму ${orderTotal} ₴` : ''} ще не оплачено.
                            </Text>
                            <Text style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, margin: '0 0 28px' }}>
                                Посилання на оплату дійсне ще ~{expiresInHours} год. Після цього замовлення буде скасовано автоматично.
                            </Text>

                            {paymentUrl && (
                                <Button
                                    href={paymentUrl}
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
                                    Оплатити зараз →
                                </Button>
                            )}
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
