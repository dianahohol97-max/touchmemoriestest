-- generate-sheets registers imposition sheets with file_type='print_sheet',
-- but the CHECK allowed only 'upload'/'export' — every insert silently failed
-- and orders shipped without their ganged A4 sheets (TM-001172, 2026-08-10).
-- Applied to production 2026-08-10 via Supabase MCP.
alter table order_files drop constraint order_files_file_type_check;
alter table order_files add constraint order_files_file_type_check
  check (file_type = any (array['upload'::text, 'export'::text, 'print_sheet'::text]));
