-- One production time per product, read off products.production_time.
--
-- The hard journal card carried THREE different numbers at once:
--   products.production_time        7–10 робочих днів   ← the answer
--   products.specs[Виробництво]     10–14
--   products.options[Терміновість]  «Стандартна (5–8 днів)»
-- and the page rendered a fourth, «5–8», from a hardcoded list in
-- ProductOptionsSelector.tsx that won over the DB entirely. The travel book had
-- the same defect in a milder form: its DB rows already said 8–10 while the
-- page said 5–8, so the customer read one lead time and the deadline
-- automation computed another.
--
-- Diana confirmed 7–10 for the hard journal on 2026-09-22. This migration
-- brings specs and the urgency label to production_time; the code half (the
-- selector now derives the standard label instead of hardcoding it) is in the
-- same commit.
--
-- Safe to relabel: isUrgentOption() in lib/products.ts decides urgency on the
-- word «стандартна», never on the digits, so the rush surcharge is unaffected.
-- Only the STANDARD label is derived — the rush option is a real commercial
-- promise with its own +30% and stays exactly as written.

update products p set specs = (
  select jsonb_agg(
    case when s->>'label' = 'Виробництво'
      then s || jsonb_build_object(
        'value','7–10 робочих днів','value_en','7–10 working days',
        'value_pl','7–10 dni roboczych','value_de','7–10 Werktage','value_ro','7–10 zile lucrătoare')
      else s end order by ord)
  from jsonb_array_elements(p.specs) with ordinality as e(s, ord))
where p.slug = 'fotozhurnal-tverd-obkladynka';

update products p set options = (
  select jsonb_agg(
    case when g->>'name' = 'Терміновість'
      then jsonb_set(g, '{options}', (
        select jsonb_agg(
          case when o->>'value' = 'standard'
            then o || jsonb_build_object('label','Стандартна (7–10 днів)')
            else o end order by o_ord)
        from jsonb_array_elements(g->'options') with ordinality as oe(o, o_ord)))
      else g end order by ord)
  from jsonb_array_elements(p.options) with ordinality as ge(g, ord))
where p.slug = 'fotozhurnal-tverd-obkladynka';
