-- Cleanup: drop 49 empty tables that have zero rows AND no foreign-key references
-- from tables that contain actual data.
--
-- Audit performed 2026-05-01: 117 tables → 66 tables after this migration.
-- Kept 6 empty tables that orders/fiscal_rules reference (bank_accounts,
-- customer_projects, fiscal_accounts, np_accounts, print_profiles, referral_codes)
-- because they're future infrastructure for the checkout pipeline.
--
-- All migrations applied to prod can be reverted by restoring from Supabase
-- daily backup if needed.

DROP TABLE IF EXISTS public.admin_formats CASCADE;
DROP TABLE IF EXISTS public.admin_global_rules CASCADE;
DROP TABLE IF EXISTS public.admin_materials CASCADE;
DROP TABLE IF EXISTS public.admin_product_configs CASCADE;
DROP TABLE IF EXISTS public.admin_templates CASCADE;
DROP TABLE IF EXISTS public.automation_logs CASCADE;
DROP TABLE IF EXISTS public.automation_rules CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.constructor_product_templates CASCADE;
DROP TABLE IF EXISTS public.daily_logs CASCADE;
DROP TABLE IF EXISTS public.dashboard_files CASCADE;
DROP TABLE IF EXISTS public.dashboard_subtasks CASCADE;
DROP TABLE IF EXISTS public.design_briefs CASCADE;
DROP TABLE IF EXISTS public.design_revisions CASCADE;
DROP TABLE IF EXISTS public.editor_frames CASCADE;
DROP TABLE IF EXISTS public.email_campaign_logs CASCADE;
DROP TABLE IF EXISTS public.email_campaigns CASCADE;
DROP TABLE IF EXISTS public.email_logs CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.gift_certificates CASCADE;
DROP TABLE IF EXISTS public.gift_hints CASCADE;
DROP TABLE IF EXISTS public.magazine_briefs CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.materials_movements CASCADE;
DROP TABLE IF EXISTS public.media CASCADE;
DROP TABLE IF EXISTS public.media_library CASCADE;
DROP TABLE IF EXISTS public.message_templates CASCADE;
DROP TABLE IF EXISTS public.notification_log CASCADE;
DROP TABLE IF EXISTS public.order_files CASCADE;
DROP TABLE IF EXISTS public.order_history CASCADE;
DROP TABLE IF EXISTS public.order_tag_assignments CASCADE;
DROP TABLE IF EXISTS public.pins CASCADE;
DROP TABLE IF EXISTS public.product_stock CASCADE;
DROP TABLE IF EXISTS public.project_comments CASCADE;
DROP TABLE IF EXISTS public.project_notifications CASCADE;
DROP TABLE IF EXISTS public.promo_code_usages CASCADE;
DROP TABLE IF EXISTS public.promotional_banners CASCADE;
DROP TABLE IF EXISTS public.qc_error_log CASCADE;
DROP TABLE IF EXISTS public.recipes CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.role_pricing CASCADE;
DROP TABLE IF EXISTS public.salary_calculations CASCADE;
DROP TABLE IF EXISTS public.social_conversations CASCADE;
DROP TABLE IF EXISTS public.social_messages CASCADE;
DROP TABLE IF EXISTS public.staff_schedule CASCADE;
DROP TABLE IF EXISTS public.staff_shifts CASCADE;
DROP TABLE IF EXISTS public.staff_work_log CASCADE;
DROP TABLE IF EXISTS public.stock_alerts CASCADE;
DROP TABLE IF EXISTS public.wishlists CASCADE;
