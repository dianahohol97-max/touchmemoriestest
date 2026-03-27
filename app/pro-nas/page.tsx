import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import { Heart, Award, Users } from 'lucide-react';

export const metadata = {
  title: 'Про нас | Touch.Memories',
  description: 'Touch.Memories — студія у Тернополі, яка створює фотокниги, журнали та вироби зі спогадів з 2018 року. Якість, індивідуальний підхід, довіра тисяч клієнтів.',
};

export default function ProNasPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />

      <main className="flex-1 pt-32 pb-20">
        <div className="container max-w-5xl mx-auto px-4">
          {/* Hero Section */}
          <header className="text-center mb-20">
            <h1 className="text-5xl font-black text-gray-900 mb-6 font-heading tracking-tight">
              Про нас
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Touch.Memories — студія у Тернополі, яка створює фотокниги, тревел-буки, глянцеві журнали 
              та вироби зі спогадів з 2018 року.
            </p>
          </header>

          {/* About Section */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-10 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Ми — Touch Memories</h2>
            <div className="prose prose-lg max-w-none text-gray-600 leading-relaxed space-y-4">
              <p>
                Touch Memories — це більше, ніж просто друк. Ми — команда, яка глибоко вірить у силу спогадів.
              </p>
              <p>
                Кожна фотографія, кожна мить — це частина твоєї історії. І ми хочемо, щоб ці моменти жили поруч з тобою: у красивій фотокнизі, у стильному журналі, на якісному друку.
              </p>
              <p>
                Ми підходимо до кожного замовлення індивідуально — тому що кожна людина особлива, і кожна її історія заслуговує найкращого втілення.
              </p>
            </div>
          </section>

          {/* Values Section */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Наші цінності</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Value 1 */}
              <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 text-center">
                <div className="bg-[#dbeafe] p-3 rounded-lg w-14 h-14 flex items-center justify-center mb-4 mx-auto">
                  <Award className="text-[#1e2d7d] w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Якість</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Преміальні матеріали, професійний друк та ретельна увага до деталей у кожному замовленні.
                </p>
              </div>

              {/* Value 2 */}
              <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 text-center">
                <div className="bg-[#dbeafe] p-3 rounded-lg w-14 h-14 flex items-center justify-center mb-4 mx-auto">
                  <Heart className="text-[#1e2d7d] w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Індивідуальний підхід</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Ми розуміємо, що кожна історія унікальна, тому допомагаємо з вибором формату та дизайну.
                </p>
              </div>

              {/* Value 3 */}
              <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 text-center">
                <div className="bg-[#dbeafe] p-3 rounded-lg w-14 h-14 flex items-center justify-center mb-4 mx-auto">
                  <Users className="text-[#1e2d7d] w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Довіра клієнтів</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Понад 20 000 задоволених клієнтів вже довірили нам свої найцінніші спогади.
                </p>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="bg-[#1e2d7d] rounded-lg p-12 text-white text-center">
            <h2 className="text-3xl font-bold mb-4 text-white">Збережіть свої спогади назавжди</h2>
            <p className="text-white/90 mb-8 text-lg max-w-2xl mx-auto">
              Оберіть формат, який підходить саме вам — і ми зробимо все інше.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/catalog"
                className="inline-block bg-white text-[#1e2d7d] px-8 py-4 rounded-lg font-bold hover:bg-stone-100 transition-colors text-center"
              >
                Перейти до каталогу
              </Link>
              <Link
                href="/constructor/photobook"
                className="inline-block bg-transparent border-2 border-white px-8 py-4 rounded-lg font-bold hover:bg-white hover:text-[#1e2d7d] transition-all text-center"
              >
                Створити зараз
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer categories={[]} />
    </div>
  );
}
