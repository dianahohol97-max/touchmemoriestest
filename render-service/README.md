# TouchMemories Render Service — деплой на Railway

Цей сервіс відкриває сторінку `/print` у справжньому headless Chrome (Playwright)
і знімає кожен розворот у друкарській якості 300 DPI, після чого заливає JPG у
Supabase. Це заміна html2canvas — друк стає піксель-в-піксель як на екрані.

## Що тобі знадобиться
- Акаунт на https://railway.app (безкоштовний стартовий тариф підходить для тесту)
- Значення змінних (нижче)

## Крок 1 — Створити проєкт на Railway
1. Зайди на railway.app → **New Project** → **Deploy from GitHub repo**
2. Обери репозиторій `dianahohol97-max/touchmemoriestest`
3. Railway спитає що деплоїти. Важливо: вкажи **Root Directory** = `render-service`
   (Settings → Service → Root Directory). Без цього він спробує зібрати весь сайт.
4. Railway сам побачить `Dockerfile` у цій папці і збере через нього.

## Крок 2 — Додати змінні середовища
У Railway: твій сервіс → вкладка **Variables** → додай по черзі:

| Назва | Значення |
|---|---|
| `APP_BASE_URL` | `https://touchmemories.com.ua` (або preview-URL гілки для тесту) |
| `PRINT_RENDER_TOKEN` | `8edd74cea7801a3a13f9f522ccb9dccd1c2d4d6ebf26e6ee` (той самий що у Vercel) |
| `RENDER_SERVICE_TOKEN` | згенеруй НОВИЙ секрет (нижче) — це пароль щоб викликати сам сервіс |
| `SUPABASE_URL` | `https://yivfsicvaoewxrtkrfxr.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ключ з Supabase (Settings → API) |
| `STORAGE_BUCKET` | `photobook-uploads` |

Згенерувати `RENDER_SERVICE_TOKEN` (виконай локально або в будь-якому терміналі):
```
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```
Збережи це значення — воно знадобиться в Vercel на кроці інтеграції.

## Крок 3 — Дочекатись деплою
Railway збере Docker-образ (~2-4 хв, бо тягне Chromium). Коли стане зелений
"Active" — сервіс готовий. Railway дасть публічний URL виду
`https://touchmemories-render-service-production.up.railway.app`.
(Settings → Networking → Generate Domain, якщо домену ще немає.)

## Крок 4 — Перевірити що живий
Відкрий у браузері `{твій-railway-url}/health` — має повернути `{"ok":true}`.

## Крок 5 — Тестовий рендер
Надішли POST-запит (через термінал або Postman):
```
curl -X POST {твій-railway-url}/render \
  -H "Content-Type: application/json" \
  -H "x-render-token: {RENDER_SERVICE_TOKEN}" \
  -d '{"projectId":"7916682c-1a29-4cc1-8cde-3a8dc7468fc3"}'
```
Має повернути `{"ok":true, "spreads":4, "uploaded":[...]}` і залити JPG у Supabase
у папку `{userId}/{orderId}/print/`.

## Крок 6 — Дай мені Railway URL
Коли сервіс живий — скажи мені його URL і значення `RENDER_SERVICE_TOKEN`
(або просто додай токен у Vercel сам). Далі я інтегрую виклик сервісу в checkout
замість html2canvas, і налаштую щоб кожне замовлення рендерилось автоматично.

---

### Примітки
- Сервіс рендерить по одному розвороту за раз — стабільно навіть для великих книг.
- Якщо рендер падає на конкретній сторінці — Railway logs покажуть на якій і чому.
- Розміри друку (мм) зашиті в `server.ts` (`PRINT_DIMS_MM`) і збігаються з застосунком.
- Для нових форматів (A4-журнал, travelbook) додамо їхні мм-розміри сюди ж.
