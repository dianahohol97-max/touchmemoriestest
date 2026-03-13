import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Button,
  Hr,
} from '@react-email/components';

interface DesignerBriefEmailProps {
  customerName: string;
  orderNumber: string;
  briefUrl: string;
}

export default function DesignerBriefEmail({
  customerName = 'Шановний клієнте',
  orderNumber = '#12345',
  briefUrl = 'https://touchmemories.com.ua/brief/token',
}: DesignerBriefEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>TOUCH MEMORIES</Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Text style={greeting}>Вітаємо, {customerName}!</Text>

            <Text style={paragraph}>
              Дякуємо за замовлення <strong>{orderNumber}</strong> з послугою дизайнера
              "Зроби за мене" 🎨
            </Text>

            <Text style={paragraph}>
              Щоб ми створили для вас ідеальний фотоальбом, потрібно всього 3 кроки:
            </Text>

            {/* Steps */}
            <Section style={stepsContainer}>
              <Text style={step}>
                <span style={stepNumber}>1</span>
                <span style={stepText}>Завантажте 20-50 найкращих фото</span>
              </Text>
              <Text style={step}>
                <span style={stepNumber}>2</span>
                <span style={stepText}>Заповніть короткий бриф про ваші побажання</span>
              </Text>
              <Text style={step}>
                <span style={stepNumber}>3</span>
                <span style={stepText}>
                  Наш AI проаналізує фото, а дизайнер створить макет
                </span>
              </Text>
            </Section>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={briefUrl}>
                Заповнити бриф і завантажити фото
              </Button>
            </Section>

            <Text style={paragraph}>
              Або скопіюйте посилання:
              <br />
              <Link href={briefUrl} style={link}>
                {briefUrl}
              </Link>
            </Text>

            <Hr style={hr} />

            {/* What to Expect */}
            <Text style={heading}>Що далі?</Text>

            <Text style={paragraph}>
              ✅ <strong>AI обробить ваші фото</strong> — проаналізує якість,
              виявить найкращі моменти
            </Text>

            <Text style={paragraph}>
              🎨 <strong>Дизайнер створить макет</strong> — на основі AI-аналізу
              та ваших побажань
            </Text>

            <Text style={paragraph}>
              👀 <strong>Ви переглянете та затвердите</strong> — можна залишити
              коментарі та запросити до 2 безкоштовних правок
            </Text>

            <Text style={paragraph}>
              🖨️ <strong>Друк та доставка</strong> — ваш унікальний альбом буде
              надрукований і доставлений Новою Поштою
            </Text>

            <Hr style={hr} />

            {/* Help */}
            <Text style={helpText}>
              Потрібна допомога? Напишіть нам:
              <br />
              📧 Email:{' '}
              <Link href="mailto:info@touchmemories.com.ua" style={link}>
                info@touchmemories.com.ua
              </Link>
              <br />
              📱 Telegram:{' '}
              <Link href="https://t.me/touchmemories" style={link}>
                @touchmemories
              </Link>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © 2026 TOUCH MEMORIES. Створюємо спогади, що залишаються назавжди.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '32px 20px',
  textAlign: 'center' as const,
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

const logo = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
  letterSpacing: '1px',
};

const content = {
  padding: '0 40px',
};

const greeting = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#333333',
  marginTop: '32px',
  marginBottom: '16px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#555555',
  marginBottom: '16px',
};

const heading = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#333333',
  marginTop: '24px',
  marginBottom: '16px',
};

const stepsContainer = {
  margin: '32px 0',
  padding: '24px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
};

const step = {
  fontSize: '16px',
  color: '#333333',
  margin: '16px 0',
  display: 'flex',
  alignItems: 'center',
};

const stepNumber = {
  display: 'inline-block',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  backgroundColor: '#667eea',
  color: '#ffffff',
  textAlign: 'center' as const,
  lineHeight: '32px',
  fontWeight: 'bold',
  marginRight: '12px',
  fontSize: '16px',
};

const stepText = {
  flex: 1,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#667eea',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '18px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 40px',
};

const link = {
  color: '#667eea',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
};

const helpText = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#666666',
  textAlign: 'center' as const,
};

const footer = {
  padding: '20px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '12px',
  color: '#999999',
  lineHeight: '20px',
};
