-- ==========================================
-- Inventory Automations RPC & Triggers
-- ==========================================

-- Function to handle order stock reservations (Called on payment_status = 'paid')
CREATE OR REPLACE FUNCTION reserve_order_stock(p_order_id UUID, p_staff_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_product RECORD;
    v_items JSONB;
BEGIN
    -- 1. Get order items
    SELECT items INTO v_items FROM public.orders WHERE id = p_order_id;
    
    IF v_items IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Process each item (assuming items is an array of objects with structure { product_id, quantity, ... })
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
        -- Check if product exists and tracks inventory
        SELECT * INTO v_product FROM public.products 
        WHERE id = (v_item.value->>'product_id')::UUID AND track_inventory = true;

        IF FOUND THEN
            -- Update reserved stock
            UPDATE public.products 
            SET stock_reserved = stock_reserved + (v_item.value->>'quantity')::INTEGER
            WHERE id = v_product.id;

            -- Log movement
            INSERT INTO public.inventory_movements (
                product_id, type, quantity, quantity_before, quantity_after, reason, order_id, added_by
            ) VALUES (
                v_product.id, 'reserved', -(v_item.value->>'quantity')::INTEGER, 
                v_product.stock_quantity, v_product.stock_quantity, 
                'Order Paid Reservation', p_order_id, p_staff_id
            );
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

-- Function to handle shipping stock deduction (Called on order_status = 'shipped')
CREATE OR REPLACE FUNCTION ship_order_stock(p_order_id UUID, p_staff_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_product RECORD;
    v_items JSONB;
BEGIN
    SELECT items INTO v_items FROM public.orders WHERE id = p_order_id;
    IF v_items IS NULL THEN RETURN FALSE; END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
        SELECT * INTO v_product FROM public.products 
        WHERE id = (v_item.value->>'product_id')::UUID AND track_inventory = true;

        IF FOUND THEN
            -- Deduct from physical stock and release reservation
            UPDATE public.products 
            SET stock_quantity = stock_quantity - (v_item.value->>'quantity')::INTEGER,
                stock_reserved = stock_reserved - (v_item.value->>'quantity')::INTEGER
            WHERE id = v_product.id;

            -- Log movement (with cost price recording for P&L)
            INSERT INTO public.inventory_movements (
                product_id, type, quantity, quantity_before, quantity_after, reason, order_id, cost_per_unit, added_by
            ) VALUES (
                v_product.id, 'out', -(v_item.value->>'quantity')::INTEGER, 
                v_product.stock_quantity, v_product.stock_quantity - (v_item.value->>'quantity')::INTEGER, 
                'Order Shipped', p_order_id, v_product.cost_price, p_staff_id
            );
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

-- Function to handle order cancellation stock release
CREATE OR REPLACE FUNCTION cancel_order_stock(p_order_id UUID, p_staff_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_product RECORD;
    v_items JSONB;
BEGIN
    SELECT items INTO v_items FROM public.orders WHERE id = p_order_id;
    IF v_items IS NULL THEN RETURN FALSE; END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
        SELECT * INTO v_product FROM public.products 
        WHERE id = (v_item.value->>'product_id')::UUID AND track_inventory = true;

        IF FOUND THEN
            -- Check if we previously reserved this (simple approach: just reduce reservation)
            -- In a robust system we check if an 'out' or 'reserved' movement exists first.
            UPDATE public.products 
            SET stock_reserved = GREATEST(0, stock_reserved - (v_item.value->>'quantity')::INTEGER)
            WHERE id = v_product.id;

            INSERT INTO public.inventory_movements (
                product_id, type, quantity, quantity_before, quantity_after, reason, order_id, added_by
            ) VALUES (
                v_product.id, 'unreserved', (v_item.value->>'quantity')::INTEGER, 
                v_product.stock_quantity, v_product.stock_quantity, 
                'Order Cancelled', p_order_id, p_staff_id
            );
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;
