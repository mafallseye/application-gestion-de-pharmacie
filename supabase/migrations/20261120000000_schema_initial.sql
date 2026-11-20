-- Pharmacie : schéma initial (Postgres / Supabase).
-- Remplace l'ancien schéma MySQL : vrais types (numeric, date), clés étrangères,
-- ventes détaillées par article, et droits d'accès par rôle (RLS).

-- ---------------------------------------------------------------------------
-- Rôles applicatifs et profils
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'pharmacien', 'caissier');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       public.user_role not null default 'caissier',
  -- Un compte créé par inscription libre reste inactif : il ne voit rien
  -- tant qu'un administrateur ne l'a pas activé.
  active     boolean not null default false,
  created_at timestamptz not null default now()
);

-- Schéma non exposé par l'API : fonctions internes utilisées par les règles d'accès.
create schema if not exists private;

create function private.user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.active
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_role() is not null
$$;

create function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.user_role() in ('admin', 'pharmacien'), false)
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.user_role() = 'admin', false)
$$;

-- Chaque compte d'authentification reçoit un profil (inactif par défaut).
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Données métier
-- ---------------------------------------------------------------------------

create table public.categories (
  id         bigint generated always as identity primary key,
  name       text not null check (length(btrim(name)) between 1 and 120),
  short_name text not null default '' check (length(short_name) <= 30),
  created_at timestamptz not null default now()
);
create unique index categories_name_key on public.categories (lower(btrim(name)));

create table public.suppliers (
  id         bigint generated always as identity primary key,
  name       text not null check (length(btrim(name)) between 1 and 160),
  address    text not null default '' check (length(address) <= 255),
  phone      text not null default '' check (length(phone) <= 40),
  fax        text not null default '' check (length(fax) <= 40),
  info       text not null default '' check (length(info) <= 1000),
  created_at timestamptz not null default now()
);

create table public.customers (
  id         bigint generated always as identity primary key,
  name       text not null check (length(btrim(name)) between 1 and 160),
  address    text not null default '' check (length(address) <= 255),
  phone      text not null default '' check (length(phone) <= 40),
  fax        text not null default '' check (length(fax) <= 40),
  info       text not null default '' check (length(info) <= 1000),
  created_at timestamptz not null default now()
);

create table public.medicines (
  id                  bigint generated always as identity primary key,
  brand_name          text not null check (length(btrim(brand_name)) between 1 and 160),
  generic_name        text not null default '' check (length(generic_name) <= 160),
  category_id         bigint references public.categories (id) on delete set null,
  supplier_id         bigint references public.suppliers (id) on delete set null,
  price               numeric(12, 2) not null check (price >= 0),
  quantity            integer not null default 0 check (quantity >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  expiry_date         date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index medicines_category_id_idx on public.medicines (category_id);
create index medicines_supplier_id_idx on public.medicines (supplier_id);
create index medicines_expiry_date_idx on public.medicines (expiry_date);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger medicines_touch_updated_at
  before update on public.medicines
  for each row execute function private.touch_updated_at();

create table public.sales (
  id            bigint generated always as identity primary key,
  customer_id   bigint references public.customers (id) on delete set null,
  -- Nom figé au moment de la vente : la vente reste lisible si le client est supprimé.
  customer_name text not null default '',
  grand_total   numeric(14, 2) not null default 0 check (grand_total >= 0),
  paid_amount   numeric(14, 2) not null default 0 check (paid_amount >= 0),
  sold_at       timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null,
  constraint sales_paid_not_above_total check (paid_amount <= grand_total)
);
create index sales_customer_id_idx on public.sales (customer_id);
create index sales_created_by_idx on public.sales (created_by);
create index sales_sold_at_idx on public.sales (sold_at desc);

create table public.sale_items (
  id            bigint generated always as identity primary key,
  sale_id       bigint not null references public.sales (id) on delete cascade,
  medicine_id   bigint references public.medicines (id) on delete set null,
  medicine_name text not null,
  unit_price    numeric(12, 2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    numeric(14, 2) generated always as (unit_price * quantity) stored
);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_medicine_id_idx on public.sale_items (medicine_id);

-- Annuler une vente (suppression) remet les quantités en stock.
create function private.restore_stock_on_item_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.medicine_id is not null then
    update public.medicines
    set quantity = quantity + old.quantity
    where id = old.medicine_id;
  end if;
  return old;
end;
$$;

create trigger sale_items_restore_stock
  after delete on public.sale_items
  for each row execute function private.restore_stock_on_item_delete();

-- ---------------------------------------------------------------------------
-- Enregistrer une vente : contrôle du stock, décrément et total, en une seule
-- transaction. C'est le seul moyen de créer une vente (pas d'INSERT direct).
--   p_items : [{"medicine_id": 1, "quantity": 2}, ...]
-- ---------------------------------------------------------------------------

create function public.create_sale(
  p_customer_id bigint,
  p_paid_amount numeric,
  p_items       jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id  bigint;
  v_customer text := '';
  v_total    numeric(14, 2) := 0;
  v_item     record;
  v_med      public.medicines%rowtype;
begin
  if not private.is_staff() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La vente doit contenir au moins un article.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Trop d''articles dans une seule vente.' using errcode = '22023';
  end if;
  if p_paid_amount is null or p_paid_amount < 0 then
    raise exception 'Le montant payé est invalide.' using errcode = '22023';
  end if;

  if p_customer_id is not null then
    select c.name into v_customer from public.customers c where c.id = p_customer_id;
    if not found then
      raise exception 'Client introuvable.' using errcode = '22023';
    end if;
  end if;

  insert into public.sales (customer_id, customer_name, created_by)
  values (p_customer_id, v_customer, (select auth.uid()))
  returning id into v_sale_id;

  -- Parcours trié par médicament : deux ventes simultanées verrouillent
  -- les lignes dans le même ordre (pas d'interblocage).
  for v_item in
    select (e ->> 'medicine_id')::bigint as medicine_id,
           sum((e ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as e
    group by 1
    order by 1
  loop
    if v_item.medicine_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Article invalide.' using errcode = '22023';
    end if;

    select * into v_med from public.medicines m where m.id = v_item.medicine_id for update;
    if not found then
      raise exception 'Médicament introuvable.' using errcode = '22023';
    end if;
    if v_med.expiry_date is not null and v_med.expiry_date < current_date then
      raise exception 'Le médicament « % » est périmé.', v_med.brand_name using errcode = '22023';
    end if;
    if v_med.quantity < v_item.quantity then
      raise exception 'Stock insuffisant pour « % » (% en stock).', v_med.brand_name, v_med.quantity
        using errcode = '22023';
    end if;

    update public.medicines set quantity = quantity - v_item.quantity where id = v_med.id;

    insert into public.sale_items (sale_id, medicine_id, medicine_name, unit_price, quantity)
    values (v_sale_id, v_med.id, v_med.brand_name, v_med.price, v_item.quantity);

    v_total := v_total + v_med.price * v_item.quantity;
  end loop;

  if p_paid_amount > v_total then
    raise exception 'Le montant payé dépasse le total de la vente.' using errcode = '22023';
  end if;

  update public.sales set grand_total = v_total, paid_amount = p_paid_amount where id = v_sale_id;
  return v_sale_id;
end;
$$;

-- Chiffres du tableau de bord (respecte les règles d'accès de l'appelant).
create function public.dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'medicines_count', (select count(*) from public.medicines),
    'stock_value',     (select coalesce(sum(price * quantity), 0) from public.medicines),
    'low_stock_count', (select count(*) from public.medicines where quantity <= low_stock_threshold),
    'expired_count',   (select count(*) from public.medicines where expiry_date < current_date),
    'expiring_count',  (select count(*) from public.medicines
                        where expiry_date >= current_date and expiry_date < current_date + 90),
    'customers_count', (select count(*) from public.customers),
    'suppliers_count', (select count(*) from public.suppliers),
    'sales_today',     (select coalesce(sum(grand_total), 0) from public.sales
                        where sold_at >= date_trunc('day', now())),
    'sales_month',     (select coalesce(sum(grand_total), 0) from public.sales
                        where sold_at >= date_trunc('month', now())),
    'unpaid_total',    (select coalesce(sum(grand_total - paid_amount), 0) from public.sales),
    'sales_by_day',    (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'total', d.total) order by d.day), '[]'::jsonb)
      from (
        select g.day::date as day, coalesce(sum(s.grand_total), 0) as total
        from generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') as g(day)
        left join public.sales s on s.sold_at >= g.day and s.sold_at < g.day + interval '1 day'
        group by g.day
      ) d
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- Droits : rien pour les visiteurs anonymes ; RLS partout.
--   caissier   : lit tout, enregistre des ventes, ajoute/modifie des clients
--   pharmacien : + gère médicaments, catégories, fournisseurs, encaissements
--   admin      : + supprime des ventes, gère les utilisateurs
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
revoke execute on function private.handle_new_user() from authenticated;
revoke execute on function private.restore_stock_on_item_delete() from authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, role, active) on public.profiles to authenticated;
grant select, insert, update, delete on public.categories, public.suppliers, public.customers, public.medicines to authenticated;
grant select, delete on public.sales to authenticated;
grant update (paid_amount) on public.sales to authenticated;
grant select on public.sale_items to authenticated;
grant execute on function public.create_sale(bigint, numeric, jsonb) to authenticated;
grant execute on function public.dashboard_stats() to authenticated;

alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers  enable row level security;
alter table public.customers  enable row level security;
alter table public.medicines  enable row level security;
alter table public.sales      enable row level security;
alter table public.sale_items enable row level security;

-- Profils : chacun voit le sien (même inactif, pour afficher « compte en attente ») ;
-- le personnel actif voit tout le monde ; seul l'admin modifie.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy categories_select on public.categories for select to authenticated
  using ((select private.is_staff()));
create policy categories_insert on public.categories for insert to authenticated
  with check ((select private.is_manager()));
create policy categories_update on public.categories for update to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy categories_delete on public.categories for delete to authenticated
  using ((select private.is_manager()));

create policy suppliers_select on public.suppliers for select to authenticated
  using ((select private.is_staff()));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check ((select private.is_manager()));
create policy suppliers_update on public.suppliers for update to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy suppliers_delete on public.suppliers for delete to authenticated
  using ((select private.is_manager()));

create policy medicines_select on public.medicines for select to authenticated
  using ((select private.is_staff()));
create policy medicines_insert on public.medicines for insert to authenticated
  with check ((select private.is_manager()));
create policy medicines_update on public.medicines for update to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy medicines_delete on public.medicines for delete to authenticated
  using ((select private.is_manager()));

create policy customers_select on public.customers for select to authenticated
  using ((select private.is_staff()));
create policy customers_insert on public.customers for insert to authenticated
  with check ((select private.is_staff()));
create policy customers_update on public.customers for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy customers_delete on public.customers for delete to authenticated
  using ((select private.is_manager()));

create policy sales_select on public.sales for select to authenticated
  using ((select private.is_staff()));
create policy sales_update_payment on public.sales for update to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy sales_delete on public.sales for delete to authenticated
  using ((select private.is_admin()));

create policy sale_items_select on public.sale_items for select to authenticated
  using ((select private.is_staff()));

-- Un administrateur ne peut pas se retirer lui-même son rôle ni se désactiver
-- (évite de se retrouver sans aucun administrateur par erreur).
create function private.protect_own_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id = (select auth.uid()) and (new.role <> old.role or new.active <> old.active) then
    raise exception 'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre compte.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_own_admin
  before update on public.profiles
  for each row execute function private.protect_own_admin();
