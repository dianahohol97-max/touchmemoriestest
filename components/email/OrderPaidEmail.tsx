import {
    Body,
    Container,
    Column,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Row,
    Section,
    Text,
} from '@react-email/components';
import * as React from 'react';

interface OrderPaidEmailProps {
    orderNumber?: string;
    customerName?: string;
    variant?: 'full' | 'prepayment';
    paidAmount?: number;
    remainingAmount?: number;
    total?: number;
    // Optional admin override of the intro paragraph (blank line = new paragraph).
    body?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

export const OrderPaidEmail = ({
    orderNumber = 'PB-2026-ХХХХ',
    customerName = 'Петро',
    variant = 'full',
    paidAmount = 0,
    remainingAmount = 0,
    total = 0,
    body,
}: OrderPaidEmailProps) => {
    const isPrepay = variant === 'prepayment';
    const heading = isPrepay ? 'Передоплату отримано' : 'Оплату отримано';
    const defaultIntro = isPrepay
        ? `Привіт, ${customerName}. Дякуємо — ми отримали передоплату за замовлення №${orderNumber} і вже беремось за роботу. Залишок сплачується при отриманні.`
        : `Привіт, ${customerName}. Дякуємо — ми отримали повну оплату за замовлення №${orderNumber}. Уже беремось за роботу й повідомимо, щойно воно буде готове до відправлення.`;
    const introParts = (body && body.trim() ? body : defaultIntro)
        .split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

    return (
        <Html>
            <Head />
            <Preview>{heading} — замовлення №{orderNumber}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Text style={logoText}>TouchMemories</Text>
                    </Section>
                    <Section style={content}>
                        <Section style={badge}>
                            <Text style={badgeText}>✓ {isPrepay ? 'ПЕРЕДОПЛАТА' : 'ОПЛАЧЕНО'}</Text>
                        </Section>

                        <Heading style={headingStyle}>{heading}</Heading>

                        {introParts.map((p, i) => (
                            <Text key={i} style={text}>{p}</Text>
                        ))}

                        <Hr style={hr} />

                        <Section style={payBox}>
                            <Row>
                                <Column style={leftColumn}>
                                    {isPrepay ? 'Сплачено передоплату:' : 'Сплачено:'}
                                </Column>
                                <Column style={rightColumnStrong}>{paidAmount} ₴</Column>
                            </Row>
                            {isPrepay && (
                                <>
                                    <Row>
                                        <Column style={leftColumn}>Залишок при отриманні:</Column>
                                        <Column style={rightColumn}>{remainingAmount} ₴</Column>
                                    </Row>
                                    <Row>
                                        <Column style={leftColumnTotal}><strong>Загальна сума:</strong></Column>
                                        <Column style={rightColumnTotal}><strong>{total} ₴</strong></Column>
                                    </Row>
                                </>
                            )}
                        </Section>

                        <Text style={footerText}>
                            Якщо у вас є запитання щодо цього замовлення, просто дайте відповідь на цей лист.
                        </Text>
                    </Section>

                    <Section style={footer}>
                        <Text style={footerLinks}>
                            <Link href={baseUrl} style={link}>Магазин</Link> •{' '}
                            <Link href={`${baseUrl}/terms`} style={link}>Умови договору</Link> •{' '}
                            <Link href={'https://instagram.com/touch.memories'} style={link}>Instagram</Link>
                        </Text>
                        <Text style={footerCopyright}>
                            © {new Date().getFullYear()} TouchMemories. Всі права захищено.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default OrderPaidEmail;

// Styles
const main = {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};
const container = {
    backgroundColor: '#ffffff',
    margin: '40px auto',
    padding: '0',
    borderRadius: '3px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    maxWidth: '600px',
    overflow: 'hidden',
};
const header = {
    backgroundColor: '#263A99',
    padding: '32px 40px',
    textAlign: 'center' as const,
};
const logoText = {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '700',
    margin: '0',
    letterSpacing: '-0.5px',
};
const content = { padding: '40px' };
const badge = { marginBottom: '20px' };
const badgeText = {
    display: 'inline-block',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '1px',
    padding: '6px 14px',
    borderRadius: '999px',
    margin: '0',
};
const headingStyle = {
    fontSize: '24px',
    color: '#263A99',
    fontWeight: '700',
    margin: '0 0 16px',
};
const text = {
    color: '#4b5563',
    fontSize: '15px',
    lineHeight: '22px',
    margin: '0 0 16px',
};
const hr = { borderColor: '#e5e7eb', margin: '24px 0' };
const payBox = {
    backgroundColor: '#f9fafb',
    padding: '20px 24px',
    borderRadius: '3px',
};
const leftColumn = { fontSize: '14px', color: '#6b7280', paddingBottom: '8px' };
const rightColumn = { fontSize: '14px', color: '#263A99', textAlign: 'right' as const, paddingBottom: '8px' };
const rightColumnStrong = { fontSize: '16px', color: '#15803d', fontWeight: '700', textAlign: 'right' as const, paddingBottom: '8px' };
const leftColumnTotal = { fontSize: '16px', color: '#263A99', paddingTop: '8px' };
const rightColumnTotal = { fontSize: '18px', color: '#263A99', textAlign: 'right' as const, paddingTop: '8px' };
const footerText = { fontSize: '14px', color: '#6b7280', margin: '32px 0 0' };
const footer = {
    padding: '32px 40px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center' as const,
};
const footerLinks = { margin: '0 0 16px' };
const link = { color: '#4b5563', textDecoration: 'underline', fontSize: '13px' };
const footerCopyright = { color: '#9ca3af', fontSize: '12px', margin: '0' };
