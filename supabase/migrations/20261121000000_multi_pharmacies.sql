-- Plusieurs pharmacies sur la même application (SaaS) + abonnement.
--   * chaque ligne appartient à une pharmacie ; personne ne voit ni ne modifie
--     les données d'une autre pharmacie (RLS + clés étrangères composées) ;
--   * période d'essai puis abonnement : sans accès en cours, la pharmacie
--     passe en lecture seule ;
--   * les ventes sont numérotées par pharmacie, sans trou.

-- ---------------------------------------------------------------------------
-- Pharmacies et offres
-- ---------------------------------------------------------------------------

create table public.pharmacies (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (length(btrim(name)) between 1 and 160),
  phone                text not null default '' check (length(phone) <= 40),
  address              text not null default '' check (length(address) <= 255),
  trial_ends_at        timestamptz not null default now() + interval '14 days',
  subscription_ends_at timestamptz,
  created_at           timestamptz not null default now()
);

create table public.plans (
  code   text primary key,
  label  text not null,
  amount numeric(12, 0) not null check (amount > 0),
  months integer not null check (months > 0)
);
insert into public.plans (code, label, amount, months) values
  ('mensuel', 'Abonnement mensuel', 10000, 1),
  ('annuel', 'Abonnement annuel', 100000, 12);

create table public.subscription_payments (
  id             bigint generated always as identity primary key,
  pharmacy_id    uuid not null references public.pharmacies (id) on delete cascade,
  plan           text not null references public.plans (code),
  amount         numeric(12, 0) not null check (amount > 0),
  months         integer not null check (months > 0),
  status         text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  provider_token text unique,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz
);
create index subscription_payments_pharmacy_idx on public.subscription_payments (pharmacy_id, created_at desc);
create index subscription_payments_created_by_idx on public.subscription_payments (created_by);

-- ---------------------------------------------------------------------------
-- Rattachement des comptes et des données à une pharmacie
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column pharmacy_id uuid references public.pharmacies (id) on delete cascade;
create index profiles_pharmacy_id_idx on public.profiles (pharmacy_id);

-- Les données déjà présentes deviennent celles d'une première pharmacie.
insert into public.pharmacies (name)
select 'Pharmacie de démonstration'
where exists (select 1 from public.profiles)
   or exists (select 1 from public.medicines)
   or exists (select 1 from public.sales);

update public.profiles set pharmacy_id = (select id from public.pharmacies limit 1);

create function private.current_pharmacy()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.pharmacy_id from public.profiles p
  where p.id = (select auth.uid()) and p.active
$$;

create or replace function private.user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.active and p.pharmacy_id is not null
$$;

-- Accès en écriture : période d'essai ou abonnement en cours.
create function private.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pharmacies ph
    where ph.id = private.current_pharmacy()
      and greatest(ph.trial_ends_at, coalesce(ph.subscription_ends_at, ph.trial_ends_at)) > now()
  )
$$;

do $$
declare
  t text;
begin
  foreach t in array array['categories', 'suppliers', 'customers', 'medicines', 'sales', 'sale_items', 'payments'] loop
    execute format('alter table public.%I add column pharmacy_id uuid references public.pharmacies (id) on delete cascade', t);
    execute format('update public.%I set pharmacy_id = (select id from public.pharmacies limit 1)', t);
    execute format('alter table public.%I alter column pharmacy_id set not null', t);
    execute format('alter table public.%I alter column pharmacy_id set default private.current_pharmacy()', t);
    execute format('create index %I on public.%I (pharmacy_id)', t || '_pharmacy_id_idx', t);
  end loop;
end $$;

-- Une ligne ne peut référencer qu'une ligne de la même pharmacie.
alter table public.categories add constraint categories_pharmacy_id_id_key unique (pharmacy_id, id);
alter table public.suppliers  add constraint suppliers_pharmacy_id_id_key  unique (pharmacy_id, id);
alter table public.customers  add constraint customers_pharmacy_id_id_key  unique (pharmacy_id, id);
alter table public.medicines  add constraint medicines_pharmacy_id_id_key  unique (pharmacy_id, id);
alter table public.sales      add constraint sales_pharmacy_id_id_key      unique (pharmacy_id, id);

alter table public.medicines
  drop constraint medicines_category_id_fkey,
  drop constraint medicines_supplier_id_fkey,
  add constraint medicines_category_fkey foreign key (pharmacy_id, category_id)
    references public.categories (pharmacy_id, id) on delete set null (category_id),
  add constraint medicines_supplier_fkey foreign key (pharmacy_id, supplier_id)
    references public.suppliers (pharmacy_id, id) on delete set null (supplier_id);

alter table public.sales
  drop constraint sales_customer_id_fkey,
  add constraint sales_customer_fkey foreign key (pharmacy_id, customer_id)
    references public.customers (pharmacy_id, id) on delete set null (customer_id);

alter table public.sale_items
  drop constraint sale_items_sale_id_fkey,
  drop constraint sale_items_medicine_id_fkey,
  add constraint sale_items_sale_fkey foreign key (pharmacy_id, sale_id)
    references public.sales (pharmacy_id, id) on delete cascade,
  add constraint sale_items_medicine_fkey foreign key (pharmacy_id, medicine_id)
    references public.medicines (pharmacy_id, id) on delete set null (medicine_id);

alter table public.payments
  drop constraint payments_sale_id_fkey,
  add constraint payments_sale_fkey foreign key (pharmacy_id, sale_id)
    references public.sales (pharmacy_id, id) on delete cascade;

-- Le nom d'une catégorie est unique dans une pharmacie, pas dans toute l'application.
drop index public.categories_name_key;
create unique index categories_name_key on public.categories (pharmacy_id, lower(btrim(name)));

-- Numéro de vente propre à chaque pharmacie (1, 2, 3… sans trou).
alter table public.sales add column number integer;
update public.sales s set number = n.rn
from (select id, row_number() over (partition by pharmacy_id order by id) as rn from public.sales) n
where n.id = s.id;
alter table public.sales alter column number set not null;
alter table public.sales add constraint sales_pharmacy_number_key unique (pharmacy_id, number);

-- ---------------------------------------------------------------------------
-- Inscription d'une nouvelle pharmacie par son futur administrateur
-- ---------------------------------------------------------------------------

create or replace function private.protect_own_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.pharmacy_id is not null and old.id = (select auth.uid())
     and (new.role <> old.role or new.active <> old.active) then
    raise exception 'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre compte.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create function public.register_pharmacy(
  p_name      text,
  p_phone     text,
  p_address   text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_profile  public.profiles%rowtype;
  v_pharmacy uuid;
begin
  if v_user is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles p where p.id = v_user for update;
  if not found then
    raise exception 'Compte introuvable.' using errcode = '22023';
  end if;
  if v_profile.pharmacy_id is not null then
    raise exception 'Ce compte est déjà rattaché à une pharmacie.' using errcode = '22023';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 160 then
    raise exception 'Le nom de la pharmacie est obligatoire (160 caractères au plus).' using errcode = '22023';
  end if;
  if length(coalesce(p_phone, '')) > 40 or length(coalesce(p_address, '')) > 255
     or length(coalesce(p_full_name, '')) > 120 then
    raise exception 'Un des champs est trop long.' using errcode = '22023';
  end if;

  insert into public.pharmacies (name, phone, address)
  values (btrim(p_name), btrim(coalesce(p_phone, '')), btrim(coalesce(p_address, '')))
  returning id into v_pharmacy;

  update public.profiles
  set pharmacy_id = v_pharmacy,
      role = 'admin',
      active = true,
      full_name = case when btrim(coalesce(p_full_name, '')) <> '' then btrim(p_full_name) else full_name end
  where id = v_user;

  return v_pharmacy;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ventes et encaissements, cloisonnés par pharmacie
-- ---------------------------------------------------------------------------

drop function public.create_sale(bigint, numeric, jsonb, numeric);

create function public.create_sale(
  p_customer_id    bigint,
  p_paid_amount    numeric,
  p_items          jsonb,
  p_expected_total numeric
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pharmacy uuid := private.current_pharmacy();
  v_sale_id  bigint;
  v_number   integer;
  v_customer text := '';
  v_total    numeric(14, 2) := 0;
  v_item     record;
  v_med      public.medicines%rowtype;
begin
  if v_pharmacy is null or not private.is_staff() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  if not private.can_write() then
    raise exception 'Votre abonnement a expiré : renouvelez-le pour enregistrer des ventes.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La vente doit contenir au moins un article.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Trop d''articles dans une seule vente.' using errcode = '22023';
  end if;
  if p_paid_amount is null or p_paid_amount = 'NaN' or p_paid_amount < 0
     or p_paid_amount <> trunc(p_paid_amount) then
    raise exception 'Le montant payé est invalide.' using errcode = '22023';
  end if;

  if p_customer_id is not null then
    select c.name into v_customer from public.customers c
    where c.id = p_customer_id and c.pharmacy_id = v_pharmacy;
    if not found then
      raise exception 'Client introuvable.' using errcode = '22023';
    end if;
  end if;

  -- Verrou sur la pharmacie : les ventes d'une même pharmacie se numérotent
  -- l'une après l'autre ; une vente refusée ne consomme pas de numéro.
  perform 1 from public.pharmacies ph where ph.id = v_pharmacy for update;
  select coalesce(max(s.number), 0) + 1 into v_number from public.sales s where s.pharmacy_id = v_pharmacy;

  insert into public.sales (pharmacy_id, number, customer_id, customer_name, created_by)
  values (v_pharmacy, v_number, p_customer_id, v_customer, (select auth.uid()))
  returning id into v_sale_id;

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

    select * into v_med from public.medicines m
    where m.id = v_item.medicine_id and m.pharmacy_id = v_pharmacy for update;
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

    insert into public.sale_items (pharmacy_id, sale_id, medicine_id, medicine_name, unit_price, quantity)
    values (v_pharmacy, v_sale_id, v_med.id, v_med.brand_name, v_med.price, v_item.quantity);

    v_total := v_total + v_med.price * v_item.quantity;
  end loop;

  if p_expected_total is null or p_expected_total <> v_total then
    raise exception 'Les prix ont changé : le total est maintenant de % FCFA. Vérifiez le panier.', v_total::bigint
      using errcode = '22023';
  end if;
  if p_paid_amount > v_total then
    raise exception 'Le montant payé dépasse le total de la vente.' using errcode = '22023';
  end if;
  if p_paid_amount < v_total and p_customer_id is null then
    raise exception 'Une vente à crédit doit être rattachée à un client.' using errcode = '22023';
  end if;

  update public.sales set grand_total = v_total, paid_amount = p_paid_amount where id = v_sale_id;
  if p_paid_amount > 0 then
    insert into public.payments (pharmacy_id, sale_id, amount, created_by)
    values (v_pharmacy, v_sale_id, p_paid_amount, (select auth.uid()));
  end if;
  return v_sale_id;
end;
$$;

create or replace function public.record_payment(p_sale_id bigint, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pharmacy uuid := private.current_pharmacy();
  v_sale     public.sales%rowtype;
begin
  if v_pharmacy is null or not private.is_staff() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  if not private.can_write() then
    raise exception 'Votre abonnement a expiré : renouvelez-le pour enregistrer un encaissement.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount = 'NaN' or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'Le montant encaissé doit être un nombre entier supérieur à zéro.' using errcode = '22023';
  end if;

  select * into v_sale from public.sales s
  where s.id = p_sale_id and s.pharmacy_id = v_pharmacy for update;
  if not found then
    raise exception 'Vente introuvable.' using errcode = '22023';
  end if;
  if v_sale.paid_amount + p_amount > v_sale.grand_total then
    raise exception 'Le montant dépasse le reste à payer (% FCFA).', (v_sale.grand_total - v_sale.paid_amount)::bigint
      using errcode = '22023';
  end if;

  update public.sales set paid_amount = paid_amount + p_amount where id = p_sale_id;
  insert into public.payments (pharmacy_id, sale_id, amount, created_by)
  values (v_pharmacy, p_sale_id, p_amount, (select auth.uid()));
  return v_sale.paid_amount + p_amount;
end;
$$;

-- ---------------------------------------------------------------------------
-- Abonnement : validation d'un paiement (appelée par le serveur uniquement,
-- après vérification auprès de PayDunya). Sans effet si déjà validé.
-- ---------------------------------------------------------------------------

create function public.complete_subscription_payment(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.subscription_payments%rowtype;
begin
  select * into v_pay from public.subscription_payments sp
  where sp.provider_token = p_token for update;
  if not found or v_pay.status = 'completed' then
    return false;
  end if;

  update public.subscription_payments set status = 'completed', paid_at = now() where id = v_pay.id;

  -- Les mois achetés s'ajoutent à la fin de l'accès en cours (essai compris).
  update public.pharmacies ph
  set subscription_ends_at =
        greatest(now(), ph.trial_ends_at, coalesce(ph.subscription_ends_at, ph.trial_ends_at))
        + make_interval(months => v_pay.months)
  where ph.id = v_pay.pharmacy_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits et règles d'accès
-- ---------------------------------------------------------------------------

revoke all on public.pharmacies, public.plans, public.subscription_payments from anon, authenticated;
revoke all on function public.register_pharmacy(text, text, text, text) from public, anon;
revoke all on function public.create_sale(bigint, numeric, jsonb, numeric) from public, anon;
revoke all on function public.complete_subscription_payment(text) from public, anon, authenticated;
revoke all on function private.current_pharmacy() from public, anon;
revoke all on function private.can_write() from public, anon;

grant select on public.pharmacies, public.plans, public.subscription_payments to authenticated;
grant update (name, phone, address) on public.pharmacies to authenticated;
grant execute on function public.register_pharmacy(text, text, text, text) to authenticated;
grant execute on function public.create_sale(bigint, numeric, jsonb, numeric) to authenticated;
grant execute on function public.complete_subscription_payment(text) to service_role;
grant execute on function private.current_pharmacy() to authenticated;
grant execute on function private.can_write() to authenticated;

alter table public.pharmacies            enable row level security;
alter table public.plans                 enable row level security;
alter table public.subscription_payments enable row level security;

create policy pharmacies_select on public.pharmacies for select to authenticated
  using (id = (select private.current_pharmacy()));
create policy pharmacies_update on public.pharmacies for update to authenticated
  using (id = (select private.current_pharmacy()) and (select private.is_admin()))
  with check (id = (select private.current_pharmacy()) and (select private.is_admin()));

create policy plans_select on public.plans for select to authenticated using (true);

create policy subscription_payments_select on public.subscription_payments for select to authenticated
  using (pharmacy_id = (select private.current_pharmacy()) and (select private.is_admin()));

-- Remplacement de toutes les règles existantes par leur version cloisonnée.
drop policy profiles_select on public.profiles;
drop policy profiles_update_admin on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid())
         or ((select private.is_staff()) and pharmacy_id = (select private.current_pharmacy())));
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select private.is_admin()) and pharmacy_id = (select private.current_pharmacy()))
  with check ((select private.is_admin()) and pharmacy_id = (select private.current_pharmacy()));

do $$
declare
  t text;
begin
  -- Tables gérées par le pharmacien ou l'administrateur.
  foreach t in array array['categories', 'suppliers', 'medicines'] loop
    execute format('drop policy %I on public.%I', t || '_select', t);
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format('drop policy %I on public.%I', t || '_delete', t);
    execute format($p$create policy %I on public.%I for select to authenticated
      using ((select private.is_staff()) and pharmacy_id = (select private.current_pharmacy()))$p$, t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check ((select private.is_manager()) and (select private.can_write())
                  and pharmacy_id = (select private.current_pharmacy()))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using ((select private.is_manager()) and (select private.can_write())
             and pharmacy_id = (select private.current_pharmacy()))
      with check ((select private.is_manager()) and (select private.can_write())
                  and pharmacy_id = (select private.current_pharmacy()))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using ((select private.is_manager()) and (select private.can_write())
             and pharmacy_id = (select private.current_pharmacy()))$p$, t || '_delete', t);
  end loop;
end $$;

drop policy customers_select on public.customers;
drop policy customers_insert on public.customers;
drop policy customers_update on public.customers;
drop policy customers_delete on public.customers;
create policy customers_select on public.customers for select to authenticated
  using ((select private.is_staff()) and pharmacy_id = (select private.current_pharmacy()));
create policy customers_insert on public.customers for insert to authenticated
  with check ((select private.is_staff()) and (select private.can_write())
              and pharmacy_id = (select private.current_pharmacy()));
create policy customers_update on public.customers for update to authenticated
  using ((select private.is_staff()) and (select private.can_write())
         and pharmacy_id = (select private.current_pharmacy()))
  with check ((select private.is_staff()) and (select private.can_write())
              and pharmacy_id = (select private.current_pharmacy()));
create policy customers_delete on public.customers for delete to authenticated
  using ((select private.is_manager()) and (select private.can_write())
         and pharmacy_id = (select private.current_pharmacy()));

drop policy sales_select on public.sales;
drop policy sales_delete on public.sales;
create policy sales_select on public.sales for select to authenticated
  using ((select private.is_staff()) and pharmacy_id = (select private.current_pharmacy()));
create policy sales_delete on public.sales for delete to authenticated
  using ((select private.is_admin()) and (select private.can_write())
         and pharmacy_id = (select private.current_pharmacy()));

drop policy sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items for select to authenticated
  using ((select private.is_staff()) and pharmacy_id = (select private.current_pharmacy()));

drop policy payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
  using ((select private.is_staff()) and pharmacy_id = (select private.current_pharmacy()));
