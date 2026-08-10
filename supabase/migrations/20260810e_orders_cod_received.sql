-- When the cash-on-delivery part of an order actually reached us.
--
-- Until now nothing recorded this. `cod_amount` says what the courier is meant
-- to collect, but there was no way to tell an order still in transit from one
-- whose money has arrived — so anything reading "how much has this order
-- brought in" had to either ignore cash on delivery entirely or count it as
-- received the moment the order was placed. Both answers are wrong, in opposite
-- directions.
--
-- Set when the order reaches its delivered state, and left alone otherwise.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cod_received_at timestamptz;

COMMENT ON COLUMN orders.cod_received_at IS
  'Момент, коли післяплату отримано. NULL означає, що гроші ще в дорозі.';
