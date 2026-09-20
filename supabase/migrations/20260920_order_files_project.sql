-- Який саме виріб замовлення дав цей файл.
--
-- Досі картка вгадувала це з шляху: рендер кладе файли в
-- drafts/{userId}/{projectId}/print/, і адмінка шукала у шляху сегмент, схожий
-- на id макета. Для книги, фото якої заливалися гостьовим шляхом, шлях має
-- вигляд guest/{cartItemId}/print/ — id макета там немає взагалі, і файли
-- лишалися нічиїми. Саме так на TM-001342 друга книга відрендерилася повністю,
-- а картка показувала один макет: сімнадцять готових аркушів нікуди не
-- привʼязалися.
--
-- Імена файлів у різних книг однакові («01.jpg», «cover.jpg»), тож звʼязок
-- мусить бути явним, а не вгаданим.
alter table public.order_files
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists order_files_order_project_idx
  on public.order_files (order_id, project_id);

comment on column public.order_files.project_id is
  'Макет (projects.id), який дав цей файл. Заповнюється рендером; у старих рядків виводиться зі шляху.';
