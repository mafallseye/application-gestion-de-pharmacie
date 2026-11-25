-- Paiement des ventes par mobile money (NabooPay), encaissé sur le compte de
-- chaque pharmacie.
--   * les clés de la pharmacie sont chiffrées (Vault) et lisibles uniquement
--     par le serveur ; l'application ne peut que les remplacer ;
--   * une vente « mobile » est enregistrée impayée (stock réservé), puis soldée
--     par le serveur quand le prestataire confirme le paiement, ou annulée ;
--   * le reste à payer d'une vente à crédit peut aussi être encaissé ainsi.

alter table public.pharmacies add column mobile_money_enabled boolean not null default false;
alter table public.sales add column awaiting_mobile boolean not null default false;
alter table public.payments
  add column method text not null default 'cash' check (method in ('cash', 'mobile')),
  add column reference text;

-- ---------------------------------------------------------------------------
-- Clés de paiement de chaque pharmacie (jamais exposées par l'API)
-- ---------------------------------------------------------------------------

create table private.pharmacy_payment_keys (
  pharmacy_id       uuid primary key references public.pharmacies (id) on delete cascade,
  api_key_id        uuid not null,
  webhook_secret_id uuid,
  updated_by        uuid,
  updated_at        timestamptz not null default now()
);
alter table private.pharmacy_payment_keys enable row level security;
revoke all on private.pharmacy_payment_keys from public, anon, authenticated;

create function public.set_pharmacy_payment_keys(
  p_pharmacy       uuid,
  p_user           uuid,
  p_api_key        text,
  p_webhook_secret text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.pharmacy_payment_keys%rowtype;
  v_api uuid;
  v_hook uuid;
begin
  if p_api_key is null or length(btrim(p_api_key)) not between 8 and 500 then
    raise exception 'Clé d''API invalide.' using errcode = '22023';
  end if;
  if p_webhook_secret is not null and length(btrim(p_webhook_secret)) not between 8 and 500 then
    raise exception 'Clé de webhook invalide.' using errcode = '22023';
  end if;
  select * into v_row from private.pharmacy_payment_keys k where k.pharmacy_id = p_pharmacy for update;

  if v_row.api_key_id is not null then
    perform vault.update_secret(v_row.api_key_id, btrim(p_api_key));
    v_api := v_row.api_key_id;
  else
    v_api := vault.create_secret(btrim(p_api_key), 'naboopay_api_key_' || p_pharmacy::text);
  end if;

  v_hook := v_row.webhook_secret_id;
  if p_webhook_secret is not null then
    if v_hook is not null then
      perform vault.update_secret(v_hook, btrim(p_webhook_secret));
    else
      v_hook := vault.create_secret(btrim(p_webhook_secret), 'naboopay_webhook_' || p_pharmacy::text);
    end if;
  end if;

  insert into private.pharmacy_payment_keys (pharmacy_id, api_key_id, webhook_secret_id, updated_by)
  values (p_pharmacy, v_api, v_hook, p_user)
  on conflict (pharmacy_id) do update
    set api_key_id = excluded.api_key_id,
        webhook_secret_id = excluded.webhook_secret_id,
        updated_by = excluded.updated_by,
        updated_at = now();
  update public.pharmacies set mobile_money_enabled = true where id = p_pharmacy;
end;
$$;

create function public.clear_pharmacy_payment_keys(p_pharmacy uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.pharmacy_payment_keys%rowtype;
begin
  delete from private.pharmacy_payment_keys k where k.pharmacy_id = p_pharmacy returning * into v_row;
  delete from vault.secrets s where s.id in (v_row.api_key_id, v_row.webhook_secret_id);
  update public.pharmacies set mobile_money_enabled = false where id = p_pharmacy;
end;
$$;

create function public.get_pharmacy_payment_keys(p_pharmacy uuid)
returns table (api_key text, webhook_secret text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select d.decrypted_secret from vault.decrypted_secrets d where d.id = k.api_key_id),
    (select d.decrypted_secret from vault.decrypted_secrets d where d.id = k.webhook_secret_id)
  from private.pharmacy_payment_keys k
  where k.pharmacy_id = p_pharmacy
$$;

-- ---------------------------------------------------------------------------
-- Demandes de paiement mobile d'une vente
-- ---------------------------------------------------------------------------

create table public.sale_mobile_payments (
  id           bigint generated always as identity primary key,
  pharmacy_id  uuid not null references public.pharmacies (id) on delete cascade,
  sale_id      bigint not null,
  amount       numeric(14, 2) not null check (amount > 0 and amount = trunc(amount)),
  status       text not null default 'pending' check (status in ('pending', 'completed', 'cancelled', 'review')),
  provider     text not null default 'naboopay',
  order_id     text unique,
  checkout_url text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  paid_at      timestamptz,
  constraint sale_mobile_payments_sale_fkey foreign key (pharmacy_id, sale_id)
    references public.sales (pharmacy_id, id) on delete cascade
);
-- Une seule demande en attente par vente.
create unique index sale_mobile_payments_one_pending on public.sale_mobile_payments (sale_id) where status = 'pending';
create index sale_mobile_payments_sale_idx on public.sale_mobile_payments (pharmacy_id, sale_id);
create index sale_mobile_payments_created_by_idx on public.sale_mobile_payments (created_by);

alter table public.sale_mobile_payments enable row level security;
revoke all on public.sale_mobile_payments from anon, authenticated;
grant select on public.sale_mobile_payments to authenticated;
create policy sale_mobile_payments_select on public.sale_mobile_payments for select to authenticated
  using ((select private.is_staff()) and pharmacy_id = (select private.current_pharmacy()));

-- Ouvre (ou retrouve) la demande de paiement mobile d'une vente.
-- Appelée par le serveur pour le compte de l'utilisateur p_user.
create function public.start_sale_mobile_payment(p_user uuid, p_sale_id bigint, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_ph      public.pharmacies%rowtype;
  v_sale    public.sales%rowtype;
  v_pending public.sale_mobile_payments%rowtype;
  v_amount  numeric(14, 2);
  v_id      bigint;
begin
  select * into v_profile from public.profiles p where p.id = p_user;
  if not found or not v_profile.active or v_profile.pharmacy_id is null then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  select * into v_ph from public.pharmacies ph where ph.id = v_profile.pharmacy_id;
  if greatest(v_ph.trial_ends_at, coalesce(v_ph.subscription_ends_at, v_ph.trial_ends_at)) <= now() then
    raise exception 'Votre abonnement a expiré : renouvelez-le pour encaisser.' using errcode = '42501';
  end if;
  if not v_ph.mobile_money_enabled then
    raise exception 'Le paiement par mobile money n''est pas configuré pour cette pharmacie.' using errcode = '22023';
  end if;

  select * into v_sale from public.sales s
  where s.id = p_sale_id and s.pharmacy_id = v_ph.id for update;
  if not found then
    raise exception 'Vente introuvable.' using errcode = '22023';
  end if;

  select * into v_pending from public.sale_mobile_payments m
  where m.sale_id = v_sale.id and m.status = 'pending';
  if found then
    return jsonb_build_object('id', v_pending.id, 'amount', v_pending.amount, 'order_id', v_pending.order_id,
      'checkout_url', v_pending.checkout_url, 'pharmacy_id', v_ph.id, 'sale_number', v_sale.number,
      'pharmacy_name', v_ph.name, 'existing', true);
  end if;

  v_amount := coalesce(p_amount, v_sale.grand_total - v_sale.paid_amount);
  if v_amount = 'NaN' or v_amount <= 0 or v_amount <> trunc(v_amount) then
    raise exception 'Le montant à encaisser est invalide.' using errcode = '22023';
  end if;
  if v_sale.paid_amount + v_amount > v_sale.grand_total then
    raise exception 'Le montant dépasse le reste à payer (% FCFA).', (v_sale.grand_total - v_sale.paid_amount)::bigint
      using errcode = '22023';
  end if;

  insert into public.sale_mobile_payments (pharmacy_id, sale_id, amount, created_by)
  values (v_ph.id, v_sale.id, v_amount, p_user)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'amount', v_amount, 'order_id', null, 'checkout_url', null,
    'pharmacy_id', v_ph.id, 'sale_number', v_sale.number, 'pharmacy_name', v_ph.name, 'existing', false);
end;
$$;

-- Le prestataire confirme le paiement : la vente est créditée. Sans effet si déjà fait.
create function public.complete_sale_mobile_payment(p_order_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay  public.sale_mobile_payments%rowtype;
  v_sale public.sales%rowtype;
begin
  select * into v_pay from public.sale_mobile_payments m where m.order_id = p_order_id for update;
  if not found then
    return 'unknown';
  end if;
  if v_pay.status <> 'pending' then
    return v_pay.status;
  end if;
  select * into v_sale from public.sales s where s.id = v_pay.sale_id for update;

  -- Argent reçu mais la vente ne peut plus l'absorber (déjà soldée autrement) :
  -- on ne perd pas l'information, un contrôle manuel décidera (remboursement).
  if v_sale.paid_amount + v_pay.amount > v_sale.grand_total then
    update public.sale_mobile_payments set status = 'review', paid_at = now() where id = v_pay.id;
    return 'review';
  end if;

  update public.sales
  set paid_amount = paid_amount + v_pay.amount, awaiting_mobile = false
  where id = v_sale.id;
  insert into public.payments (pharmacy_id, sale_id, amount, created_by, method, reference)
  values (v_pay.pharmacy_id, v_sale.id, v_pay.amount, v_pay.created_by, 'mobile', p_order_id);
  update public.sale_mobile_payments set status = 'completed', paid_at = now() where id = v_pay.id;
  return 'completed';
end;
$$;

-- Abandon d'une demande de paiement. Si la vente n'existait que pour ce
-- paiement (vente « mobile » jamais payée), elle est annulée et le stock revient.
create function public.cancel_sale_mobile_payment(p_order_id text, p_payment_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay  public.sale_mobile_payments%rowtype;
  v_sale public.sales%rowtype;
begin
  select * into v_pay from public.sale_mobile_payments m
  where (p_order_id is not null and m.order_id = p_order_id) or (p_order_id is null and m.id = p_payment_id)
  for update;
  if not found then
    return 'unknown';
  end if;
  if v_pay.status <> 'pending' then
    return v_pay.status;
  end if;
  update public.sale_mobile_payments set status = 'cancelled' where id = v_pay.id;

  select * into v_sale from public.sales s where s.id = v_pay.sale_id for update;
  if v_sale.awaiting_mobile and v_sale.paid_amount = 0 then
    delete from public.sales where id = v_sale.id;
    return 'sale_cancelled';
  end if;
  -- Vente réglée autrement entre-temps (espèces) : elle n'attend plus de paiement mobile.
  update public.sales set awaiting_mobile = false where id = v_sale.id and awaiting_mobile;
  return 'cancelled';
end;
$$;

-- ---------------------------------------------------------------------------
-- Enregistrer une vente : option « mobile money »
-- ---------------------------------------------------------------------------

drop function public.create_sale(bigint, numeric, jsonb, numeric);

create function public.create_sale(
  p_customer_id    bigint,
  p_paid_amount    numeric,
  p_items          jsonb,
  p_expected_total numeric,
  p_mobile         boolean default false
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
  -- Paiement par mobile money : la vente est enregistrée impayée, en attente
  -- du paiement du client ; elle sera soldée par le serveur ou annulée.
  if coalesce(p_mobile, false) then
    if p_paid_amount <> 0 then
      raise exception 'Une vente payée par mobile money ne peut pas avoir d''acompte.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.pharmacies ph where ph.id = v_pharmacy and ph.mobile_money_enabled) then
      raise exception 'Le paiement par mobile money n''est pas configuré pour cette pharmacie.' using errcode = '22023';
    end if;
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

  insert into public.sales (pharmacy_id, number, customer_id, customer_name, created_by, awaiting_mobile)
  values (v_pharmacy, v_number, p_customer_id, v_customer, (select auth.uid()), coalesce(p_mobile, false))
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
  if p_paid_amount < v_total and p_customer_id is null and not coalesce(p_mobile, false) then
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

revoke all on function public.create_sale(bigint, numeric, jsonb, numeric, boolean) from public, anon;
grant execute on function public.create_sale(bigint, numeric, jsonb, numeric, boolean) to authenticated;

revoke all on function public.set_pharmacy_payment_keys(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.clear_pharmacy_payment_keys(uuid) from public, anon, authenticated;
revoke all on function public.get_pharmacy_payment_keys(uuid) from public, anon, authenticated;
revoke all on function public.start_sale_mobile_payment(uuid, bigint, numeric) from public, anon, authenticated;
revoke all on function public.complete_sale_mobile_payment(text) from public, anon, authenticated;
revoke all on function public.cancel_sale_mobile_payment(text, bigint) from public, anon, authenticated;
grant execute on function public.set_pharmacy_payment_keys(uuid, uuid, text, text) to service_role;
grant execute on function public.clear_pharmacy_payment_keys(uuid) to service_role;
grant execute on function public.get_pharmacy_payment_keys(uuid) to service_role;
grant execute on function public.start_sale_mobile_payment(uuid, bigint, numeric) to service_role;
grant execute on function public.complete_sale_mobile_payment(text) to service_role;
grant execute on function public.cancel_sale_mobile_payment(text, bigint) to service_role;

-- L'application ne modifie que la fiche de la pharmacie, jamais ses réglages de paiement.
revoke update (mobile_money_enabled) on public.pharmacies from authenticated;
