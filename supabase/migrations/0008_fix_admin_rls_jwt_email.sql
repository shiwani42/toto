-- Fix admin RLS helpers: do not join auth.users (authenticated role
-- cannot SELECT it, which made is_admin / is_shop_admin always false
-- for real signed-in owners). Use the JWT email claim instead.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.is_shop_admin(shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_admins sa
    where sa.shop_id = shop
      and lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.my_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select sa.shop_id
  from public.shop_admins sa
  where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Shop create / self-add policies also referenced auth.users directly.
drop policy if exists "shops_insert_own" on public.shops;
create policy "shops_insert_own"
  on public.shops for insert
  with check (
    lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "shop_admins_insert_admin" on public.shop_admins;
create policy "shop_admins_insert_admin"
  on public.shop_admins for insert
  with check (
    public.is_shop_admin(shop_id)
    or exists (
      select 1 from public.shops s
      where s.id = shop_id
        and lower(s.owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
