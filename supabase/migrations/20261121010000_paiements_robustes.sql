-- Suite à la relecture du circuit de paiement et de la numérotation.

-- Un paiement reçu par PayDunya mais incohérent (montant ou référence) n'est
-- ni validé ni déclaré « échoué » : il attend une vérification manuelle.
alter table public.subscription_payments drop constraint subscription_payments_status_check;
alter table public.subscription_payments add constraint subscription_payments_status_check
  check (status in ('pending', 'completed', 'failed', 'cancelled', 'review'));

-- Numéro de vente : compteur par pharmacie, jamais réutilisé (même si la
-- dernière vente est annulée). Une vente refusée ne consomme pas de numéro,
-- car l'incrément est annulé avec la transaction.
alter table public.pharmacies add column last_sale_number integer not null default 0;
update public.pharmacies ph
set last_sale_number = coalesce((select max(s.number) from public.sales s where s.pharmacy_id = ph.id), 0);
revoke update (last_sale_number) on public.pharmacies from authenticated;

create function private.assign_sale_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pharmacies
  set last_sale_number = last_sale_number + 1
  where id = new.pharmacy_id
  returning last_sale_number into new.number;
  return new;
end;
$$;
revoke all on function private.assign_sale_number() from public, anon, authenticated;

create trigger sales_assign_number
  before insert on public.sales
  for each row execute function private.assign_sale_number();

-- La lecture seule d'un abonnement expiré porte sur les données métier
-- (stock, ventes, clients, fournisseurs). La gestion des comptes et la fiche
-- de la pharmacie restent ouvertes à l'administrateur : il doit pouvoir
-- gérer les accès et renouveler son abonnement.
comment on function private.can_write() is
  'Essai ou abonnement en cours. Conditionne les écritures métier ; pas la gestion des comptes ni la fiche de la pharmacie.';
