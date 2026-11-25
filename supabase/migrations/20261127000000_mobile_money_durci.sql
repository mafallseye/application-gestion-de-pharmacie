-- Paiement mobile des ventes : corrections issues de la relecture.
--   * une vente « mobile » a toujours sa demande de paiement, créée avec elle,
--     pour le montant total : plus de vente livrée, impayée et sans client ;
--   * pas d'encaissement en espèces tant qu'un paiement mobile est attendu ;
--   * une vente dont le lien de paiement est actif ne peut pas être supprimée,
--     et une demande n'est jamais effacée avec sa vente (trace conservée) ;
--   * une seule ouverture de paiement à la fois par vente (un seul QR code) ;
--   * les ventes en attente de paiement mobile ne comptent ni dans les
--     impayés ni dans le chiffre tant qu'elles ne sont pas payées.

alter table public.sale_mobile_payments add column claimed_at timestamptz;
alter table public.sale_mobile_payments alter column sale_id drop not null;
alter table public.sale_mobile_payments
  drop constraint sale_mobile_payments_sale_fkey,
  add constraint sale_mobile_payments_sale_fkey foreign key (pharmacy_id, sale_id)
    references public.sales (pharmacy_id, id) on delete set null (sale_id);

-- La demande de paiement naît avec la vente « mobile », dans la même transaction.
create function private.open_mobile_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.awaiting_mobile and new.grand_total > 0 and new.paid_amount = 0
     and not exists (select 1 from public.sale_mobile_payments m where m.sale_id = new.id and m.status = 'pending') then
    insert into public.sale_mobile_payments (pharmacy_id, sale_id, amount, created_by)
    values (new.pharmacy_id, new.id, new.grand_total, new.created_by);
  end if;
  return new;
end;
$$;

create trigger sales_open_mobile_request
  after update of grand_total on public.sales
  for each row when (new.awaiting_mobile)
  execute function private.open_mobile_request();

-- Suppression d'une vente : impossible tant qu'un lien de paiement est actif
-- (il faut d'abord annuler la demande, ce qui l'annule aussi chez le prestataire).
create function private.guard_sale_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.sale_mobile_payments m
    where m.sale_id = old.id and m.status = 'pending' and m.order_id is not null
  ) then
    raise exception 'Cette vente attend un paiement mobile : annulez d''abord la demande de paiement.'
      using errcode = '22023';
  end if;
  -- Demande jamais ouverte chez le prestataire : elle est close avec la vente.
  update public.sale_mobile_payments set status = 'cancelled'
  where sale_id = old.id and status = 'pending';
  return old;
end;
$$;

create trigger sales_guard_delete
  before delete on public.sales
  for each row execute function private.guard_sale_delete();

-- Pas d'espèces sur une vente qui attend un paiement mobile.
create function private.guard_cash_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.method = 'cash' and (
       exists (select 1 from public.sales s where s.id = new.sale_id and s.awaiting_mobile)
       or exists (select 1 from public.sale_mobile_payments m where m.sale_id = new.sale_id and m.status = 'pending')
     ) then
    raise exception 'Cette vente attend un paiement mobile : annulez d''abord la demande de paiement.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger payments_guard_cash
  before insert on public.payments
  for each row execute function private.guard_cash_payment();

revoke all on function private.open_mobile_request() from public, anon, authenticated;
revoke all on function private.guard_sale_delete() from public, anon, authenticated;
revoke all on function private.guard_cash_payment() from public, anon, authenticated;

-- Ouvre (ou retrouve) la demande de paiement mobile d'une vente.
--   * vente « mobile » : le montant est toujours le reste à payer en entier ;
--   * une demande pas encore ouverte chez le prestataire est réservée à un seul
--     appelant à la fois (claimed_at), pour ne jamais créer deux liens de paiement.
create or replace function public.start_sale_mobile_payment(p_user uuid, p_sale_id bigint, p_amount numeric)
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
  where m.sale_id = v_sale.id and m.status = 'pending' for update;
  if found then
    if v_pending.order_id is null then
      if v_pending.claimed_at is not null and v_pending.claimed_at > now() - interval '60 seconds' then
        raise exception 'Un paiement est déjà en cours d''ouverture pour cette vente. Réessayez dans un instant.'
          using errcode = '22023';
      end if;
      update public.sale_mobile_payments set claimed_at = now() where id = v_pending.id;
    end if;
    return jsonb_build_object('id', v_pending.id, 'amount', v_pending.amount, 'order_id', v_pending.order_id,
      'checkout_url', v_pending.checkout_url, 'pharmacy_id', v_ph.id, 'sale_number', v_sale.number,
      'pharmacy_name', v_ph.name, 'existing', v_pending.order_id is not null);
  end if;

  v_amount := v_sale.grand_total - v_sale.paid_amount;
  if not v_sale.awaiting_mobile and p_amount is not null then
    v_amount := p_amount;
  end if;
  if v_amount = 'NaN' or v_amount <= 0 or v_amount <> trunc(v_amount) then
    raise exception 'Le montant à encaisser est invalide.' using errcode = '22023';
  end if;
  if v_sale.paid_amount + v_amount > v_sale.grand_total then
    raise exception 'Le montant dépasse le reste à payer (% FCFA).', (v_sale.grand_total - v_sale.paid_amount)::bigint
      using errcode = '22023';
  end if;

  insert into public.sale_mobile_payments (pharmacy_id, sale_id, amount, created_by, claimed_at)
  values (v_ph.id, v_sale.id, v_amount, p_user, now())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'amount', v_amount, 'order_id', null, 'checkout_url', null,
    'pharmacy_id', v_ph.id, 'sale_number', v_sale.number, 'pharmacy_name', v_ph.name, 'existing', false);
end;
$$;

-- Tableau de bord : une vente en attente de paiement mobile n'est ni un impayé
-- ni du chiffre tant que le client n'a pas payé.
create or replace function public.dashboard_stats()
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
                        where sold_at >= date_trunc('day', now()) and not awaiting_mobile),
    'sales_month',     (select coalesce(sum(grand_total), 0) from public.sales
                        where sold_at >= date_trunc('month', now()) and not awaiting_mobile),
    'unpaid_total',    (select coalesce(sum(grand_total - paid_amount), 0) from public.sales where not awaiting_mobile),
    'sales_by_day',    (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'total', d.total) order by d.day), '[]'::jsonb)
      from (
        select g.day::date as day, coalesce(sum(s.grand_total), 0) as total
        from generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') as g(day)
        left join public.sales s on s.sold_at >= g.day and s.sold_at < g.day + interval '1 day' and not s.awaiting_mobile
        group by g.day
      ) d
    )
  )
$$;
