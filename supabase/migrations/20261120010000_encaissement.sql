-- Encaissement d'un reste à payer : ajout atomique au montant déjà payé.
-- Remplace la modification directe de sales.paid_amount (qui permettait de
-- baisser un montant, ou d'écraser un encaissement fait au même moment).

revoke update (paid_amount) on public.sales from authenticated;
drop policy sales_update_payment on public.sales;

create function public.record_payment(p_sale_id bigint, p_amount numeric)
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
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant encaissé doit être supérieur à zéro.' using errcode = '22023';
  end if;

  select * into v_sale from public.sales s where s.id = p_sale_id for update;
  if not found then
    raise exception 'Vente introuvable.' using errcode = '22023';
  end if;
  if v_sale.paid_amount + p_amount > v_sale.grand_total then
    raise exception 'Le montant dépasse le reste à payer (%).', v_sale.grand_total - v_sale.paid_amount
      using errcode = '22023';
  end if;

  update public.sales set paid_amount = paid_amount + p_amount where id = p_sale_id;
  return v_sale.paid_amount + p_amount;
end;
$$;

revoke all on function public.record_payment(bigint, numeric) from public, anon;
grant execute on function public.record_payment(bigint, numeric) to authenticated;
