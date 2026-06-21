import B2bRegisterPage from '@/components/b2b/B2bRegisterPage';

export const metadata = {
    title: 'Для фотографів — Touch.Memories',
    robots: { index: false, follow: false }, // non-public until launch
};

export default function PhotographersPage() {
    return (
        <B2bRegisterPage
            role="photographer"
            title="Для фотографів"
            subtitle="Партнерська програма для фотографів: пропонуйте клієнтам фотокниги, журнали та тревелбуки преміальної якості — і отримуйте постійну знижку 10% на всі замовлення цих категорій."
            benefits={[
                'Постійна знижка 10% на фотокниги, глянцеві журнали, фотодрук і travel book',
                'Знижка діє автоматично — нічого вводити не потрібно',
                'Якісний друк і збірка для ваших клієнтських проєктів',
                'Зручний онлайн-конструктор для верстки фотокниг',
            ]}
            portfolioLabel="Посилання на портфоліо"
            portfolioPlaceholder="Instagram, сайт або Behance"
            discountPercent={10}
        />
    );
}
