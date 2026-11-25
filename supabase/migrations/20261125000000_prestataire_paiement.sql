-- Le paiement d'abonnement peut passer par NabooPay ou PayDunya :
-- chaque paiement retient le prestataire qui l'a créé.
alter table public.subscription_payments
  add column provider text not null default 'paydunya'
  check (provider in ('paydunya', 'naboopay'));
