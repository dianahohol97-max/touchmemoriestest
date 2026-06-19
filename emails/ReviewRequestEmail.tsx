import { Html, Head, Body, Container, Section, Text, Button, Preview, Tailwind } from '@react-email/components';
import * as React from 'react';

interface ReviewRequestEmailProps {
  firstName?: string;
  orderNumber?: string;
  productName?: string;
  reviewUrl?: string;
  appUrl?: string;
}

export default function ReviewRequestEmail({
  firstName = '',
  orderNumber = '',
  productName = 'ваш товар',
  reviewUrl = 'https://touchmemories.com.ua/review',
  appUrl = 'https://touchmemories.com.ua',
}: ReviewRequestEmailProps) {
  const greeting = firstName ? `Привіт, ${firstName}!` : 'Привіт!';

  return (
    <Html>
      <Head />
      <Preview>Як вам {productName}? Поділіться враженнями 🌟</Preview>
      <Tailwind>
        <Body className="bg-[#f1f5f9] font-sans m-0 p-0">
          <Container className="bg-white mx-auto my-[40px] max-w-[560px] overflow-hidden border border-[#e2e8f0]">
            <Section className="bg-[#263A99] py-[24px] text-center">
              <Text className="text-[20px] font-black text-white m-0 tracking-widest uppercase">
                TouchMemories
              </Text>
            </Section>

            <Section className="p-[36px]">
              <Text className="text-[22px] font-bold text-[#263A99] mt-0 mb-[12px]">
                {greeting}
              </Text>
              <Text className="text-[15px] leading-[26px] text-[#475569] mb-[8px]">
                Ваше замовлення <strong>{orderNumber}</strong> отримано — сподіваємось, воно вас порадувало! 🎉
              </Text>
              <Text className="text-[15px] leading-[26px] text-[#475569] mb-[28px]">
                Якщо хвилинка є — поділіться враженнями про <strong>{productName}</strong>. Ваш відгук допоможе іншим покупцям зробити правильний вибір, а нам — ставати кращими.
              </Text>

              <Section className="text-center mb-[28px]">
                <Button
                  href={reviewUrl}
                  className="bg-[#263A99] text-white px-[32px] py-[14px] rounded-[8px] text-[15px] font-bold no-underline"
                >
                  ⭐ Залишити відгук
                </Button>
              </Section>

              <Text className="text-[13px] leading-[22px] text-[#94a3b8] m-0">
                Посилання персональне та дійсне 30 днів. Якщо у вас є питання — напишіть нам на{' '}
                <a href="mailto:hello@touchmemories.com.ua" style={{ color: '#263A99' }}>
                  hello@touchmemories.com.ua
                </a>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
