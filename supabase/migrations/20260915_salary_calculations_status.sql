-- Статус розрахунку зарплати і час виплати.
--
-- Екран зарплат від початку має кнопку «Позначити як виплачено» і значок стану
-- («Чернетка», «Затверджено», «Виплачено»), а маршрут PATCH пише `status` і
-- `paid_at`. У бойовій таблиці `salary_calculations` цих стовпців немає: вона
-- старша за міграцію salary_qc/20260313010000_salary_qc_module.sql, яка
-- описувала таблицю вже з ними і до бази не доїхала.
--
-- Через це кожен запис і кожна зміна статусу відмовлялися на рівні PostgREST,
-- помилку ніхто не перевіряв, і екран казав «Період розраховано», не зберігши
-- нічого. У таблиці станом на 15.09.2026 нуль рядків.
--
-- Стовпці додаються тут, а не перейменовуються в коді, бо стан розрахунку —
-- це те, заради чого екран існує: без нього неможливо відрізнити чернетку від
-- уже виплаченого. Назва суми, навпаки, приведена в коді до наявної `total`.
ALTER TABLE public.salary_calculations
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'salary_calculations_status_check'
    ) THEN
        ALTER TABLE public.salary_calculations
            ADD CONSTRAINT salary_calculations_status_check
            CHECK (status IN ('draft', 'approved', 'paid', 'partial'));
    END IF;
END $$;

COMMENT ON COLUMN public.salary_calculations.status IS
    'Стан розрахунку: draft, approved, paid, partial. Значок на екрані зарплат читає саме це поле.';
COMMENT ON COLUMN public.salary_calculations.paid_at IS
    'Коли розрахунок позначили виплаченим. Ставиться маршрутом PATCH разом зі status = paid.';
