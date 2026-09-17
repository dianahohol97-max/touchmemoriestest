import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text,
} from '@react-email/components';
import * as React from 'react';
import { pluralUk, numberWordUk } from '@/lib/text/plural-uk';

/**
 * Лист-підтвердження для заявки з дизайнером.
 *
 * Чому окремий, а не звичайний OrderPlacedEmail. У заявці з дизайнером ціни ще
 * немає: формат, кількість сторінок і обкладинку узгоджує дизайнер, і лише
 * після цього зʼявляється сума. Звичайний лист показав би зміст замовлення на
 * нуль гривень і кнопку оплати, якої не існує, тобто збрехав би саме там, де
 * людина шукає ясності.
 *
 * Чому він узагалі зʼявився. Потік із дизайнером не слав НІЧОГО: людина бачила
 * екран «Замовлення відправлено» і після того тишу. TM-001320 (Юлія Джулай,
 * девʼятнадцять фото) пролежало так дві доби, поки клієнтка не написала в
 * дирекг сама, бо не розуміла, що буде далі (Діана, 17.09.2026).
 *
 * `photosAttached` і `photosSubmitted` різняться тоді, коли частина фото не
 * доїхала. Мовчати про це не можна: саме через мовчання TM-001245 приїхало з
 * сімома знімками з двадцяти двох, і клієнтка не мала приводу повторити.
 */

interface DesignerOrderPlacedEmailProps {
    orderNumber?: string;
    /**
     * Навмисно НЕ використовується у звертанні. Українське звертання вимагає
     * кличного відмінка (Юлія → Юліє, Петро → Петре), і відмінювати чуже
     * імʼя автоматом — це гарантовано помилитися на частині імен. Безіменне
     * «Вітаємо!» краще за «Вітаємо, Юлія». Поле лишається для перегляду в адмінці.
     */
    customerName?: string;
    photosAttached?: number;
    photosSubmitted?: number;
    deliveryAddress?: string;
    /** Побажання клієнта, якщо воно було. */
    wish?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

export const DesignerOrderPlacedEmail = ({
    orderNumber = 'TM-000000',
    customerName = 'Петро',
    photosAttached = 0,
    photosSubmitted = 0,
    deliveryAddress = '',
    wish = '',
}: DesignerOrderPlacedEmailProps) => {
    const lost = Math.max(0, (photosSubmitted || 0) - (photosAttached || 0));
    return (
        <Html>
            <Head />
            <Preview>Ми отримали вашу заявку №{orderNumber} — ось що буде далі</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Text style={logoText}>TouchMemories</Text>
                    </Section>
                    <Section style={content}>
                        <Heading style={heading}>Заявку прийнято</Heading>

                        <Text style={text}>
                            Вітаємо! Ми отримали вашу заявку <strong>{orderNumber}</strong> і вже маємо ваші фото.
                        </Text>

                        {photosAttached > 0 && (
                            <Text style={text}>
                                {lost > 0
                                    ? `Долетіли ${photosAttached} ${pluralUk(photosAttached, 'знімок', 'знімки', 'знімків')} із ${photosSubmitted}, бо ${numberWordUk(lost)} ${pluralUk(lost, 'найважчий файл не пройшов', 'найважчі файли не пройшли', 'найважчих файлів не пройшли')}. Ми звʼяжемося і попросимо надіслати саме їх ще раз, тож нічого переробляти не доведеться.`
                                    : `Усі ${photosAttached} ${pluralUk(photosAttached, 'знімок збережений і вже чекає', 'знімки збережені і вже чекають', 'знімків збережені і вже чекають')} на дизайнера.`}
                            </Text>
                        )}

                        <Hr style={hr} />

                        <Heading as="h3" style={subheading}>Що буде далі</Heading>
                        <Text style={text}>
                            Найближчим часом вам напише наш дизайнер, щоб уточнити формат виробу, кількість сторінок і обкладинку.
                            Коли ці деталі узгоджені, ми рахуємо вартість і надсилаємо посилання на оплату.
                            Верстка макета починається після оплати, і готовий макет ви побачите на погодження ще до друку.
                        </Text>
                        <Text style={text}>
                            Саме тому в цьому листі ще немає суми. Вона зʼявиться тоді, коли стане зрозуміло, який саме виріб ми робимо.
                        </Text>

                        {wish ? (
                            <>
                                <Hr style={hr} />
                                <Heading as="h3" style={subheading}>Ваше побажання</Heading>
                                <Text style={text}>{wish}</Text>
                            </>
                        ) : null}

                        {deliveryAddress ? (
                            <>
                                <Hr style={hr} />
                                <Heading as="h3" style={subheading}>Дані доставки</Heading>
                                <Text style={text}>{deliveryAddress}</Text>
                            </>
                        ) : null}

                        <Text style={footerText}>
                            Якщо у вас є запитання щодо цієї заявки, просто дайте відповідь на цей лист.
                        </Text>
                    </Section>

                    <Section style={footer}>
                        <Text style={footerLinks}>
                            <Link href={baseUrl} style={link}>Магазин</Link> •{' '}
                            <Link href={`${baseUrl}/terms`} style={link}>Умови договору</Link> •{' '}
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

export default DesignerOrderPlacedEmail;

// Styles — ті самі, що в OrderPlacedEmail, щоб листи не розʼїхалися виглядом.
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

const hr = { borderColor: '#e5e7eb', margin: '24px 0' };

const footerText = {
    color: '#8898aa',
    fontSize: '13px',
    lineHeight: '20px',
    margin: '24px 0 0',
};

const footer = {
    backgroundColor: '#f6f9fc',
    padding: '24px 40px',
    textAlign: 'center' as const,
};

const footerLinks = { fontSize: '13px', margin: '0 0 8px' };

const link = { color: '#263A99', textDecoration: 'none' };

const footerCopyright = { color: '#8898aa', fontSize: '12px', margin: '0' };
