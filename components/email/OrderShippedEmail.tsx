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
    // -7% offer for tagging @touch.memories in stories (KeyCRM-style). On by default.
    igOffer?: boolean;
    // Optional admin override of the intro paragraph (blank line = new paragraph).
    body?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

export const OrderShippedEmail = ({
    orderNumber = 'PB-2026-ХХХХ',
    customerName = 'Петро',
    ttn = '20450000000000',
    deliveryMethod = 'Нова Пошта (Відділення)',
    deliveryAddress = 'Київ, Відділення №1',
    igOffer = true,
    body,
}: OrderShippedEmailProps) => {
    const introParts = (body && body.trim()
        ? body
        : `Привіт, ${customerName}. Чудові новини! Ваше замовлення ${orderNumber} вже передано в службу доставки і прямує до вас.`)
        .split(/\n{2,}/).map(pp => pp.trim()).filter(Boolean);
    // Determine the tracking URL (Currently using Nova Poshta logic)
    const trackingUrl = `https://tracking.novaposhta.ua/#/uk?en=${ttn}`;

    return (
        <Html>
            <Head />
            <Preview> Ваше замовлення №{orderNumber} рушає до вас!</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Text style={logoText}>TouchMemories</Text>
                    </Section>
                    <Section style={content}>
                        <Heading style={heading}>Замовлення відправлено!</Heading>
                        {introParts.map((pp, i) => (
                            <Text key={i} style={text}>{pp}</Text>
                        ))}

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

                        {igOffer && (
                            <Section style={offerBox}>
                                <Text style={offerTitle}>ПОДАРУНОК ЗА ВІДГУК 💙</Text>
                                <Text style={offerBig}>−7% на наступне замовлення</Text>
                                <Text style={offerText}>
                                    Коли отримаєте посилку — позначте нас <strong>@touch.memories</strong> у вашій історії в Instagram. У відповідь надішлемо персональний промокод −7% на наступне замовлення.
                                </Text>
                            </Section>
                        )}

                        <Hr style={hr} />

                        <Text style={footerText}>
                            Якщо ви маєте додаткові запитання, будь ласка, дайте відповідь на цей лист.
                        </Text>
                    </Section>

                    <Section style={footer}>
                        <Text style={footerLinks}>
                            <Link href={baseUrl} style={link}>Магазин</Link> •{' '}
                            <Link href={`${baseUrl}/terms`} style={link}>Умови Dоговору</Link> •{' '}
                            <Link href={"https://instagram.com/touch.memories"} style={link}>Instagram</Link>
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
const offerBox = {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '3px',
    padding: '24px',
    margin: '0 0 24px',
    textAlign: 'center' as const,
};
const offerTitle = {
    fontSize: '12px',
    fontWeight: '700',
    color: '#d97706',
    letterSpacing: '1px',
    margin: '0 0 8px',
};
const offerBig = {
    fontSize: '22px',
    fontWeight: '800',
    color: '#263A99',
    margin: '0 0 12px',
};
const offerText = {
    fontSize: '14px',
    lineHeight: '22px',
    color: '#4b5563',
    margin: '0',
};

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
