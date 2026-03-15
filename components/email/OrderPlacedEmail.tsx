import {
    Body,
    Container,
    Column,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Section,
    Text,
} from '@react-email/components';
import * as React from 'react';

interface OrderPlacedEmailProps {
    orderNumber?: string;
    customerName?: string;
    items?: any[];
    totals?: {
        subtotal: number;
        delivery: number;
        total: number;
    };
    deliveryAddress?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.shop';

export const OrderPlacedEmail = ({
    orderNumber = 'PB-2026-ХХХХ',
    customerName = 'Петро',
    items = [],
    totals = { subtotal: 0, delivery: 0, total: 0 },
    deliveryAddress = 'Київ, Відділення НП №1'
}: OrderPlacedEmailProps) => (
    <Html>
        <Head />
        <Preview>Дякуємо за ваше замовлення №{orderNumber}!</Preview>
        <Body style={main}>
            <Container style={container}>
                <Section style={header}>
                    {/* Placeholder for real logo */}
                    <Text style={logoText}>TouchMemories</Text>
                </Section>
                <Section style={content}>
                    <Heading style={heading}>Дякуємо за замовлення!</Heading>
                    <Text style={text}>
                        Привіт, {customerName}. Ми отримали ваше замовлення <strong>{orderNumber}</strong> і вже почали його обробляти.
                    </Text>

                    <Hr style={hr} />

                    <Heading as="h3" style={subheading}>Зміст замовлення</Heading>
                    <Section style={table}>
                        {items?.map((item, index) => (
                            <Row key={index} style={itemRow}>
                                <Column style={itemColText}>
                                    <Text style={itemName}>{item.name}</Text>
                                    <Text style={itemSubText}>Кількість: {item.qty}</Text>
                                </Column>
                                <Column style={itemColPrice}>
                                    <Text style={itemPrice}>{item.price * item.qty} ₴</Text>
                                </Column>
                            </Row>
                        ))}
                    </Section>

                    <Hr style={hr} />

                    <Section style={totalsSection}>
                        <Row>
                            <Column style={leftColumn}>Всього за товари:</Column>
                            <Column style={rightColumn}>{totals.subtotal} ₴</Column>
                        </Row>
                        <Row>
                            <Column style={leftColumn}>Доставка:</Column>
                            <Column style={rightColumn}>{totals.delivery} ₴</Column>
                        </Row>
                        <Row>
                            <Column style={leftColumnTotal}><strong>Розрахункова сума:</strong></Column>
                            <Column style={rightColumnTotal}><strong>{totals.total} ₴</strong></Column>
                        </Row>
                    </Section>

                    <Hr style={hr} />

                    <Section style={deliverySection}>
                        <Heading as="h3" style={subheading}>Дані доставки</Heading>
                        <Text style={text}>{deliveryAddress}</Text>
                    </Section>

                    <Text style={footerText}>
                        Якщо у вас є запитання щодо цього замовлення, просто дайте відповідь на цей лист.
                    </Text>
                </Section>

                <Section style={footer}>
                    <Text style={footerLinks}>
                        <Link href={baseUrl} style={link}>Магазин</Link> •{' '}
                        <Link href={`${baseUrl}/terms`} style={link}>Умови Dоговору</Link> •{' '}
                        <Link href={"https://instagram.com/touchmemories.shop"} style={link}>Instagram</Link>
                    </Text>
                    <Text style={footerCopyright}>
                        © {new Date().getFullYear()} TouchMemories. Всі права захищено.
                    </Text>
                </Section>
            </Container>
        </Body>
    </Html>
);

export default OrderPlacedEmail;

// Styles
const main = {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '40px auto',
    padding: '0',
    borderRadius: "3px",
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

const content = {
    padding: '40px',
};

const heading = {
    fontSize: '24px',
    color: '#263A99',
    fontWeight: '700',
    margin: '0 0 16px',
};

const subheading = {
    fontSize: '16px',
    color: '#263A99',
    fontWeight: '600',
    margin: '0 0 12px',
};

const text = {
    color: '#4b5563',
    fontSize: '15px',
    lineHeight: '22px',
    margin: '0 0 24px',
};

const hr = {
    borderColor: '#e5e7eb',
    margin: '24px 0',
};

const table = {
    width: '100%',
};

const itemRow = {
    marginBottom: '16px',
    display: 'flex',
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: '12px',
};

const itemColText = {
    width: '80%',
};

const itemColPrice = {
    width: '20%',
    textAlign: 'right' as const,
};

const itemName = {
    fontSize: '15px',
    color: '#263A99',
    fontWeight: '500',
    margin: '0 0 4px',
};

const itemSubText = {
    fontSize: '13px',
    color: '#6b7280',
    margin: '0',
};

const itemPrice = {
    fontSize: '15px',
    color: '#263A99',
    fontWeight: '600',
    margin: '0',
};

const totalsSection = {
    marginTop: '24px',
};

const leftColumn = {
    fontSize: '14px',
    color: '#6b7280',
    paddingBottom: '8px',
};

const rightColumn = {
    fontSize: '14px',
    color: '#263A99',
    textAlign: 'right' as const,
    paddingBottom: '8px',
};

const leftColumnTotal = {
    fontSize: '16px',
    color: '#263A99',
    paddingTop: '8px',
};

const rightColumnTotal = {
    fontSize: '18px',
    color: '#263A99',
    textAlign: 'right' as const,
    paddingTop: '8px',
};

const deliverySection = {
    backgroundColor: '#f9fafb',
    padding: '24px',
    borderRadius: "3px",
};

const footerText = {
    fontSize: '14px',
    color: '#6b7280',
    margin: '32px 0 0',
};

const footer = {
    padding: '32px 40px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center' as const,
};

const footerLinks = {
    margin: '0 0 16px',
};

const link = {
    color: '#4b5563',
    textDecoration: 'underline',
    fontSize: '13px',
};

const footerCopyright = {
    color: '#9ca3af',
    fontSize: '12px',
    margin: '0',
};
