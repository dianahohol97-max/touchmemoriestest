# Homepage customer reviews — backup

The "Відгуки клієнтів" (TextReviews) section was hidden from the homepage in
June 2026 at the owner's request. The reviews themselves were **not deleted** —
they remain the source of truth in the Supabase `reviews` table (fields:
`author`, `caption`, `rating`, `created_at`, all active). This file is an extra
text backup of the visible reviews at the time of hiding, in case they are ever
needed outside the database.

To bring the section back: uncomment the `text_reviews` block and the
`TextReviews` import in `app/[locale]/page.tsx`.

---

**Ольга Малишко**
Отримала посилку. Дуже дякую. Все сподобалось. Буду звертатись до Вас в майбутньому ❤️

**Карина Белогурова**
Щиро дякую за цей чудовий альбом! Він перевершив усі мої очікування. Фотографії неймовірно якісні, а сам альбом виконаний з великою увагою до деталей. Оформлення дуже стильне, ідеально підібране для наших фотографій. Дуже приємно переглядати ці знімки, вони викликають лише найтепліші емоції. Обов'язково рекомендуватиму вас друзям та знайомим!

**Лавренчук Вікторія**
Отримала фото. Чесно, дуже задоволена, їх якість це щось неймовірне. Там було одне дуже неякісне фото і чесно думала його не роздрукують, але навіть воно вийшло дуже гарно. Велике дякую за вашу працю ✨

**Світлана Стукало**
Дякую вам за фотокнигу 🤗 Вона така гарненька 🥰 Якраз рік тому була фотосесія вагітності, а сьогодні є вже фотокнига 😇 Дякую за роздруковані фото 😊 Дякую за швидкий друк 🌸

**Соломія Бідна**
Забрала книгу і це щось неймовірне 🥰 Друк фото, а саме його якість, як і якість виконаної роботи на всі 100%. Не пожаліла ні на мить, що довірилася вам ❤️ Дякую, що допомагаєте зберігати моменти 😊

**Даша Моргач**
Отримала фотографії. Однозначно буду замовляти ще у вас. Дякую 😊

---

Note: the `reviews` table also contains additional reviews not visible above the
fold in the screenshot (e.g. Шмельова Дарина). The database is the complete set.
