import {
    Body,
    Button,
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

interface OrderShippedEmailProps {
    orderNumber?: string;
    customerName?: string;
    ttn?: string;
    deliveryMethod?: string;
    deliveryAddress?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.shop';

export const OrderShippedEmail = ({
    orderNumber = 'PB-2026-ХХХХ',
    customerName = 'Петро',
    ttn = '20450000000000',
    deliveryMethod = 'Нова Пошта (Відділення)',
    deliveryAddress = 'Київ, Відділення №1'
}: OrderShippedEmailProps) => {
    // Determine the tracking URL (Currently using Nova Poshta logic)
    const trackingUrl = `https://tracking.novaposhta.ua/#/uk?en=${ttn}`;

    return (
        <Html>
            <Head />
            <Preview>🚚 Ваше замовлення №{orderNumber} рушає до вас!</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Text style={logoText}>TouchMemories</Text>
                    </Section>
                    <Section style={content}>
                        <Heading style={heading}>Замовлення відправлено!</Heading>
                        <Text style={text}>
                            Привіт, {customerName}. Чудові новини! Ваше замовлення <strong>{orderNumber}</strong> вже передано в службу доставки і прямує до вас.
                        </Text>

                        <Section style={trackingBox}>
                            <Text style={trackingTitle}>ДЕТАЛІ ДОСТАВКИ</Text>
                            <Text style={trackingInfo}><strong>Служба:</strong> {deliveryMethod}</Text>
                            <Text style={trackingInfo}><strong>Адреса:</strong> {deliveryAddress}</Text>
                            <Hr style={hrLight} />
                            <Text style={trackingInfo}><strong>Трекінг-номер (ТТН):</strong></Text>
                            <Text style={ttnText}>{ttn}</Text>
                            <Button href={trackingUrl} style={button}>
                                Відслідкувати посилку
                            </Button>
                        </Section>

                        <Text style={text}>
                            Зазвичай доставка займає 1-3 дні. Коли посилка прибуде до вашого відділення або поштомату, ви отримаєте сповіщення від служби доставки.
                        </Text>

                        <Hr style={hr} />

                        <Text style={footerText}>
                            Якщо ви маєте додаткові запитання, будь ласка, дайте відповідь на цей лист.
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
};

export default OrderShippedEmail;

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

const text = {
    color: '#4b5563',
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 24px',
};

const trackingBox = {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: "3px",
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
};

const trackingTitle = {
    fontSize: '12px',
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: '1px',
    margin: '0 0 16px',
};

const trackingInfo = {
    fontSize: '14px',
    color: '#263A99',
    margin: '0 0 8px',
};

const ttnText = {
    fontSize: '28px',
    fontWeight: '800',
    color: '#263A99',
    letterSpacing: '2px',
    margin: '8px 0 24px',
};

const button = {
    backgroundColor: '#263A99',
    borderRadius: "3px",
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '14px 28px',
};

const hr = {
    borderColor: '#e5e7eb',
    margin: '24px 0',
};

const hrLight = {
    borderColor: '#e5e7eb',
    margin: '16px 0',
};

const footerText = {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0',
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
