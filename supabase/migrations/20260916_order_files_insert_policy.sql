-- Анонімна вставка у order_files більше не може підкласти файл будь-куди.
--
-- ЩО БУЛО. Політика «Customers create order_files» дозволяла INSERT будь-кому
-- з `with check (true)` — те саме, що й на orders. Тобто підроблений запит міг
-- дописати рядок файлу до ЧУЖОГО замовлення, у будь-яку категорію, включно з
-- виробничими: 'export', 'print_sheet'. Такий рядок виглядає для майстерні як
-- готовий до друку файл.
--
-- НАВІЩО ПОЛІТИКА ВЗАГАЛІ. Два публічні потоки вставляють рядки файлів прямо з
-- браузера, одразу після створення замовлення: app/[locale]/order/page.tsx
-- (фото до замовлення з дизайнером) і app/[locale]/order/magazine-text-brief
-- (матеріали до брифа на текст). Усі інші записи в цю таблицю йдуть із
-- сервера під службовим ключем і RLS не бачать взагалі, а адміністратор має
-- власну політику.
--
-- ЩО ТЕПЕР МОЖНА. Тільки завантаження клієнта, тільки у відро order-files, і
-- тільки до замовлення, створеного за останню добу.
--
-- ЧОМУ ДОБА, А НЕ ГОДИНА. Виміряно на живих даних: 3 844 рядки публічних
-- завантажень, середній розрив між створенням замовлення і появою файлу —
-- 11 хвилин, найбільший — 10 годин 12 хвилин. Вікно в дві години відкинуло б
-- 70 справжніх рядків, доба покриває все з запасом.
--
-- ЧОМУ НЕ ПЕРЕВІРЯЄМО СТАТУС ЗАМОВЛЕННЯ. Спокусливо додати «і замовлення ще
-- в статусі new», але це зламало б випадок, коли менеджер підтверджує
-- замовлення, поки клієнтка ще довантажує фото. Вік замовлення — ознака
-- надійніша за статус, бо він не залежить від чужих дій.
--
-- ЧОМУ ЧЕРЕЗ ФУНКЦІЮ, А НЕ ПІДЗАПИТОМ. Підзапит до orders усередині політики
-- виконується від імені того, хто вставляє, тобто під політикою читання
-- orders — а вона анонімові чужих замовлень не показує. Підзапит повертав би
-- порожньо, і легальна вставка падала б. Тому перевірка живе в функції з
-- security definer, як і сусідні is_admin() та is_admin_user().

create or replace function public.order_open_for_client_upload(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
    select exists (
        select 1 from public.orders o
        where o.id = p_order_id
          and o.created_at > now() - interval '24 hours'
    );
$$;

revoke all on function public.order_open_for_client_upload(uuid) from public;
grant execute on function public.order_open_for_client_upload(uuid) to anon, authenticated;

drop policy if exists "Customers create order_files" on public.order_files;

create policy "Customers create order_files"
on public.order_files
for insert
with check (
    file_type = 'upload'
    and coalesce(bucket_name, 'order-files') = 'order-files'
    and public.order_open_for_client_upload(order_id)
);
