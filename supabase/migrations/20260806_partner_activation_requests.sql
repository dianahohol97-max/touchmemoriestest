-- Оформлення ліда партнером — заявка від менеджера, рішення за адміністратором
-- (Diana, 2026-08-06).
--
-- Раніше цей крок робився руками в адмінці: створити партнера з промокодом,
-- окремо проставити менеджера, окремо змінити статус ліда. Пропущений другий
-- крок означав, що менеджер не отримував свій відсоток за закриту ним угоду.
--
-- Менеджер натискає «Оформити партнером» і подає заявку — сам партнер, а отже
-- і жива знижка на сайті, зʼявляється лише після підтвердження адміністратора.
-- Менеджер зацікавлений у кількості партнерів (він має з них відсоток), тому
-- виписувати знижки самому собі він не повинен. Умови (знижка клієнту та
-- ставки комісії) менеджер не задає взагалі: заявка створюється зі
-- стандартними значеннями, а змінити їх може тільки адміністратор перед
-- підтвердженням.

CREATE TABLE IF NOT EXISTS partner_activation_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Лід, з якого виросла угода. SET NULL, бо історія заявок має пережити
  -- видалення ліда.
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  manager_id      uuid REFERENCES sales_managers(id) ON DELETE SET NULL,

  -- Копія контактів на момент подання: лід можуть згодом відредагувати, а
  -- рішення адміністратор приймає саме за тим, що бачив у заявці.
  business_name   text NOT NULL,
  contact_name    text,
  email           text NOT NULL,
  phone           text,
  website         text,
  instagram       text,
  -- travel_agency | travel_blogger | photographer — три види, які підтримує
  -- agency_partners. Весільні агенції та компанії йдуть як travel_agency:
  -- механіка коду й комісій у них та сама, різниця лише в назві.
  partner_kind    text NOT NULL DEFAULT 'travel_agency',

  -- Умови майбутнього партнера. Заповнюються стандартними значеннями і
  -- редагуються тільки в адмінці.
  client_discount numeric NOT NULL DEFAULT 5,
  travelbook_rate numeric NOT NULL DEFAULT 5,
  other_rate      numeric NOT NULL DEFAULT 3,

  -- Чому менеджер вважає, що угода закрита: про що домовились у листуванні
  -- або в директі.
  comment         text,

  -- pending | approved | declined
  status          text NOT NULL DEFAULT 'pending',
  decline_reason  text,
  -- Створений партнер — заповнюється при підтвердженні.
  partner_id      uuid REFERENCES agency_partners(id) ON DELETE SET NULL,
  decided_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Одна відкрита заявка на лід: подвійне натискання кнопки не має створювати
-- дві заявки, які потім обидві підтвердять і видадуть два коди.
CREATE UNIQUE INDEX IF NOT EXISTS partner_activation_requests_one_open
  ON partner_activation_requests(lead_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS partner_activation_requests_status_idx
  ON partner_activation_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_activation_requests_manager_idx
  ON partner_activation_requests(manager_id, created_at DESC);

-- Тільки service-role, як і решта B2B-таблиць: читання й запис ідуть через
-- API-роути з перевіркою токена кабінету або прав адміністратора.
ALTER TABLE partner_activation_requests ENABLE ROW LEVEL SECURITY;
