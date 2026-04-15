import {
    Html,
    Head,
    Body,
    Container,
    Section,
    Text,
    Button,
    Img,
    Row,
    Column,
    Preview,
    Tailwind
} from '@react-email/components';
import * as React from 'react';

interface NewProductEmailProps {
    productName: string;
    productDescription: string;
    productPrice: string;
    productImageUrl: string;
    productUrl: string;
    appUrl: string;
    recommendedProducts?: {
        name: string;
        price: string;
        imageUrl: string;
        url: string;
    }[];
}

export default function NewProductEmail({
    productName = 'Нова Преміум Фотокнига',
    productDescription = 'Збережіть найкращі моменти в ідеальній якості. Нова преміум обкладинка та щільні сторінки зроблять ваші спогади незабутніми.',
    productPrice = '1200 грн',
    productImageUrl = 'https://images.unsplash.com/photo-1544377193-33dcf4d68fb5?q=80&w=1200&auto=format&fit=crop',
    productUrl = 'https://touchmemories.ua/products/premium',
    appUrl = 'https://touchmemories.ua',
    recommendedProducts = [
        {
            name: 'Міні-бук',
            price: '450 грн',
            imageUrl: 'https://images.unsplash.com/photo-1510565809774-4b5cb3dbb7ab?q=80&w=600&auto=format&fit=crop',
            url: 'https://touchmemories.ua/products/mini'
        },
        {
            name: 'Подарунковий сертифікат',
            price: '1000 грн',
            imageUrl: 'https://images.unsplash.com/photo-1628102491629-77858ab5721f?q=80&w=600&auto=format&fit=crop',
            url: 'https://touchmemories.ua/gift'
        }
    ]
}: NewProductEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>Новинка! {productName} вже у нас </Preview>
            <Tailwind>
                <Body className="bg-[#f8fafc] font-sans text-[#263A99] m-0 p-0">
                    <Container className="bg-white mx-auto my-[40px] max-w-[600px] overflow-hidden shadow-sm border border-[#e2e8f0]">

                        {/* Hero Image */}
                        <Section>
                            <Img src={productImageUrl} width="600" height="auto" alt={productName} className="w-full object-cover max-h-[400px]" />
                        </Section>

                        {/* Content */}
                        <Section className="p-[40px] text-center">
                            <Text className="text-[#263A99] text-[14px] font-bold uppercase tracking-widest mb-[8px] m-0">
                                Нове Надходження 
                            </Text>
                            <Text className="text-[28px] font-black text-[#263A99] mt-[8px] mb-[16px] leading-tight">
                                {productName}
                            </Text>
                            <Text className="text-[16px] leading-[26px] text-[#64748b] mb-[24px]">
                                {productDescription}
                            </Text>
                            <Text className="text-[24px] font-bold text-[#263A99] my-[24px]">
                                {productPrice}
                            </Text>

                            {/* CTA */}
                            <Section className="mt-[32px] mb-[16px]">
                                <Button
                                    href={productUrl}
                                    className="bg-[#263A99] text-white px-[32px] py-[16px] rounded-[3px] text-[16px] font-bold no-underline"
                                >
                                    Переглянути деталі →
                                </Button>
                            </Section>
                        </Section>

                        {/* Recommended */}
                        {recommendedProducts && recommendedProducts.length > 0 && (
                            <Section className="bg-[#f1f5f9] p-[40px]">
                                <Text className="text-center font-bold text-[18px] mb-[24px] text-[#263A99]">
                                    Вам також може сподобатись
                                </Text>
                                <Row>
                                    {recommendedProducts.map((p, i) => (
                                        <Column key={i} className={`w-1/2 ${i === 0 ? 'pr-[8px]' : 'pl-[8px]'}`}>
                                            <div className="bg-white rounded-[3px] p-[12px] shadow-sm">
                                                <Img src={p.imageUrl} alt={p.name} className="w-full h-[140px] object-cover rounded mb-[12px]" />
                                                <Text className="font-bold text-[14px] m-0 text-[#263A99] truncate">
                                                    {p.name}
                                                </Text>
                                                <Text className="text-[14px] text-[#64748b] mt-[4px] mb-[12px] font-semibold">
                                                    {p.price}
                                                </Text>
                                                <Button href={p.url} className="bg-[#f1f5f9] text-[#475569] text-[12px] font-bold px-[12px] py-[8px] rounded block text-center no-underline">
                                                    Дивитись
                                                </Button>
                                            </div>
                                        </Column>
                                    ))}
                                </Row>
                            </Section>
                        )}
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
