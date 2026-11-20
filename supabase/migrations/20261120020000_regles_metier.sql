-- Règles métier garanties par la base (suite à la relecture) :
--   * vente à crédit : client obligatoire ;
--   * le total affiché à la caisse doit être celui calculé par la base
--     (sinon un changement de prix créait un impayé sans que personne le voie) ;
--   * montants en francs entiers, jamais NaN ;
--   * chaque encaissement est tracé (qui, quand, combien) ;
--   * reste à payer filtrable côté serveur.

alter table public.medicines
  add constraint medicines_price_whole check (price <> 'NaN' and price = trunc(price));

alter table public.profiles
  add constraint profiles_full_name_length check (length(full_name) <= 120);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  );
  return new;
end;
$$;

alter table public.sales
  add column balance numeric(14, 2) generated always as (grand_total - paid_amount) stored;
create index sales_unpaid_idx on public.sales (sold_at desc) where grand_total > paid_amount;

create table public.payments (
  id         bigint generated always as identity primary key,
  sale_id    bigint not null references public.sales (id) on delete cascade,
  amount     numeric(14, 2) not null check (amount > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_sale_id_idx on public.payments (sale_id);
create index payments_created_by_idx on public.payments (created_by);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy payments_select on public.payments for select to authenticated
  using ((select private.is_staff()));

-- Paiements déjà enregistrés avant cette migration.
insert into public.payments (sale_id, amount, created_by, created_at)
select id, paid_amount, created_by, sold_at from public.sales where paid_amount > 0;

drop function public.create_sale(bigint, numeric, jsonb);

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
  if p_paid_amount is null or p_paid_amount = 'NaN' or p_paid_amount < 0
     or p_paid_amount <> trunc(p_paid_amount) then
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
    insert into public.payments (sale_id, amount, created_by)
    values (v_sale_id, p_paid_amount, (select auth.uid()));
  end if;
  return v_sale_id;
end;
$$;

revoke all on function public.create_sale(bigint, numeric, jsonb, numeric) from public, anon;
grant execute on function public.create_sale(bigint, numeric, jsonb, numeric) to authenticated;

create or replace function public.record_payment(p_sale_id bigint, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
begin
  if not private.is_staff() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount = 'NaN' or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'Le montant encaissé doit être un nombre entier supérieur à zéro.' using errcode = '22023';
  end if;

  select * into v_sale from public.sales s where s.id = p_sale_id for update;
  if not found then
    raise exception 'Vente introuvable.' using errcode = '22023';
  end if;
  if v_sale.paid_amount + p_amount > v_sale.grand_total then
    raise exception 'Le montant dépasse le reste à payer (% FCFA).', (v_sale.grand_total - v_sale.paid_amount)::bigint
      using errcode = '22023';
  end if;

  update public.sales set paid_amount = paid_amount + p_amount where id = p_sale_id;
  insert into public.payments (sale_id, amount, created_by)
  values (p_sale_id, p_amount, (select auth.uid()));
  return v_sale.paid_amount + p_amount;
end;
$$;
