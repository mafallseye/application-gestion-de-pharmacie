<p align="center"><img src="docs/banner.png" alt="Gestion de pharmacie — Stocks, ventes, clients et fournisseurs d'une pharmacie" width="100%"></p>

# Gestion de pharmacie

Application de gestion d'une pharmacie : stock de médicaments, caisse, ventes, clients, fournisseurs et utilisateurs.

Refonte complète de la première version (PHP / MySQL, 2022) en **React** avec une base **Supabase** (Postgres).

## Fonctionnalités

- **Tableau de bord** : valeur du stock, stock bas, médicaments périmés ou bientôt périmés, ventes du jour et du mois, impayés, ventes des 7 derniers jours.
- **Caisse** : recherche de médicaments, panier, monnaie à rendre, vente au comptant ou à crédit. Le stock est contrôlé et décrémenté par la base, dans la même transaction que la vente.
- **Ventes** : historique, détail par article, encaissement d'un reste à payer, annulation (le stock est remis).
- **Médicaments, catégories, clients, fournisseurs** : listes avec recherche et filtres, ajout, modification, suppression.
- **Utilisateurs** : comptes créés par un administrateur, avec trois rôles.

| Rôle | Peut faire |
|---|---|
| Caissier | Consulter, vendre, encaisser, ajouter et modifier des clients |
| Pharmacien | En plus : gérer médicaments, catégories et fournisseurs |
| Administrateur | En plus : annuler une vente, gérer les utilisateurs |

## Technologies

React 19 · Vite · React Router · TanStack Query · Supabase (Postgres, Auth, Edge Functions) · CSS Modules · Vitest

## Sécurité

La clé utilisée par le navigateur est publique par nature : la protection est faite **dans la base**.

- **Règles d'accès par ligne (RLS)** sur toutes les tables, selon le rôle ; aucun droit pour un visiteur non connecté.
- **Compte inactif par défaut** : un compte qui n'a pas été activé par un administrateur ne voit aucune donnée.
- **Ventes et encaissements** uniquement par des fonctions de la base (`create_sale`, `record_payment`) qui vérifient le stock et les montants.
- **Gestion des comptes** par une fonction serveur (`admin-users`) réservée aux administrateurs ; la clé de service ne quitte jamais le serveur.
- Aucun secret dans le dépôt.

## Lancer le projet

Prérequis : Node.js 20 ou plus, et un projet [Supabase](https://supabase.com).

```bash
git clone https://github.com/mafallseye/application-gestion-de-pharmacie.git
cd application-gestion-de-pharmacie
npm install
cp .env.example .env.local
```

Renseigner dans `.env.local` l'URL et la clé publiable du projet Supabase (Project Settings → API), puis :

```bash
npm run dev
```

### Préparer la base

1. Exécuter dans l'ordre les fichiers de `supabase/migrations/` (SQL Editor du tableau de bord, ou `supabase db push` avec la CLI).
2. Déployer la fonction `supabase/functions/admin-users` (`supabase functions deploy admin-users`).
3. Créer le premier compte dans Authentication → Users → Add user, puis l'activer comme administrateur :

```sql
update public.profiles set role = 'admin', active = true where email = 'adresse@exemple.com';
```

4. Recommandé : désactiver l'inscription libre (Authentication → Sign In / Providers → « Allow new users to sign up »). Les comptes suivants se créent depuis l'écran Utilisateurs.

### Commandes

```bash
npm test
npm run lint
npm run build
```

## Structure

```
src/components/ui      design system (boutons, tables, modales, formulaires…)
src/components/layout  coque de l'application, écran de connexion
src/features/<entité>  accès aux données (api.js) et pages par domaine
src/lib                client Supabase, authentification, validation, formats, erreurs
src/pages              connexion, tableau de bord, pages générales
supabase/migrations    schéma, règles d'accès et fonctions de la base
supabase/functions     fonction serveur de gestion des comptes
```

La page `/apercu` montre tous les composants du design system.

> Projet commencé en 2022 pendant ma formation ; l'ancienne version PHP reste consultable dans l'historique Git.

## Auteure

**Maguette Fall SEYE** — Développeuse Full Stack, Dakar (Sénégal) · [github.com/mafallseye](https://github.com/mafallseye)
