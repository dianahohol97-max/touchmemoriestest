import B2bRegisterPage from '@/components/b2b/B2bRegisterPage';

export const metadata = {
    title: 'Для весільних агенцій — Touch.Memories',
    robots: { index: false, follow: false }, // non-public until launch
};

export default function WeddingAgenciesPage() {
    return (
        <B2bRegisterPage
            role="wedding_agency"
            title="Для весільних агенцій"
            subtitle="Партнерська програма для весільних агенцій: додайте до своїх послуг книги побажань і весільні газети — і отримуйте постійну знижку 10% на ці товари."
            benefits={[
                'Постійна знижка 10% на книги побажань та весільні газети',
                'Знижка діє автоматично — нічого вводити не потрібно',
                'Унікальні деталі, які підсилюють ваш весільний сервіс',
                'Швидке виготовлення під дати ваших подій',
            ]}
            portfolioLabel="Сайт або сторінка агенції"
            portfolioPlaceholder="Instagram або вебсайт агенції"
            discountPercent={10}
        />
    );
}
