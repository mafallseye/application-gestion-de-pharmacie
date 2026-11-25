-- L'historique garde le code de l'offre payée même si l'offre est retirée du
-- catalogue (montant et durée sont déjà figés sur chaque paiement).
alter table public.subscription_payments drop constraint subscription_payments_plan_fkey;
