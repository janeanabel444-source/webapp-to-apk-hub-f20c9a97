alter table public.apps add column if not exists is_unlisted boolean not null default false;
update public.apps set is_unlisted = true where id = 'c8261fad-30f4-40a0-baa5-fa22ab76e08a';
comment on column public.apps.is_unlisted is 'Hidden from public catalog/home/search/categories/trending/sitemap; Developer Hub and direct links still work.';