-- Lancement : un mois d'essai gratuit pour les nouvelles pharmacies, et
-- recueil des avis des utilisateurs depuis l'application.

alter table public.pharmacies alter column trial_ends_at set default now() + interval '30 days';

create table public.feedback (
  id          bigint generated always as identity primary key,
  pharmacy_id uuid not null default private.current_pharmacy() references public.pharmacies (id) on delete cascade,
  user_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  rating      smallint not null check (rating between 1 and 5),
  message     text not null default '' check (length(message) <= 2000),
  missing     text not null default '' check (length(missing) <= 2000),
  created_at  timestamptz not null default now()
);
create index feedback_pharmacy_idx on public.feedback (pharmacy_id, created_at desc);
create index feedback_user_idx on public.feedback (user_id);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
-- L'application peut seulement déposer un avis ; les avis se lisent côté exploitant.
grant insert (rating, message, missing) on public.feedback to authenticated;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (
    (select private.is_staff())
    and pharmacy_id = (select private.current_pharmacy())
    and user_id = (select auth.uid())
  );

-- Pas plus de 10 avis par personne et par jour.
create function private.limit_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.feedback f
      where f.user_id = new.user_id and f.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Vous avez déjà envoyé plusieurs avis aujourd''hui. Merci, réessayez demain.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_feedback() from public, anon, authenticated;

create trigger feedback_limit
  before insert on public.feedback
  for each row execute function private.limit_feedback();
