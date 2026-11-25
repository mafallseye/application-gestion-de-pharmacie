<p align="center"><img src="docs/banner.png" alt="Gestion de pharmacie — Stocks, ventes, clients et fournisseurs d'une pharmacie" width="100%"></p>

# Gestion de pharmacie

Application en ligne de gestion de pharmacie, proposée à plusieurs pharmacies (SaaS) : stock de médicaments, caisse, ventes, clients, fournisseurs et utilisateurs, avec abonnement payé par mobile money (Wave, Orange Money) via **NabooPay** ou **PayDunya**.

Refonte complète de la première version (PHP / MySQL, 2022) en **React** avec une base **Supabase** (Postgres).

## Fonctionnalités

- **Tableau de bord** : valeur du stock, stock bas, médicaments périmés ou bientôt périmés, ventes du jour et du mois, impayés, ventes des 7 derniers jours.
- **Caisse** : recherche de médicaments, panier, monnaie à rendre, vente au comptant ou à crédit. Le stock est contrôlé et décrémenté par la base, dans la même transaction que la vente.
- **Ventes** : historique, détail par article, encaissement d'un reste à payer, annulation (le stock est remis).
- **Médicaments, catégories, clients, fournisseurs** : listes avec recherche et filtres, ajout, modification, suppression.
- **Utilisateurs** : comptes créés par l'administrateur de la pharmacie, avec trois rôles.
- **Paiement des ventes par mobile money** (facultatif) : la pharmacie enregistre sa propre clé NabooPay ; à la caisse, le client scanne un QR code et paie avec Wave ou Orange Money, et la vente est soldée automatiquement. Les espèces restent le mode par défaut.
- **Plusieurs pharmacies** : chaque pharmacie s'inscrit, crée son espace et ne voit que ses propres données ; ses ventes sont numérotées à part.
- **Abonnement** : 30 jours d'essai, puis offre mensuelle ou annuelle payée en ligne. Sans accès en cours, la pharmacie passe en lecture seule (elle garde ses données).

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
- **Cloisonnement par pharmacie** : chaque ligne appartient à une pharmacie ; les règles d'accès et les clés étrangères empêchent toute lecture ou écriture d'une pharmacie à l'autre.
- **Compte sans pharmacie ou désactivé** : il ne voit aucune donnée.
- **Paiements** : un abonnement n'est activé qu'après vérification directe auprès du prestataire de paiement (serveur à serveur), jamais sur la seule foi du navigateur ou d'une notification.
- **Ventes et encaissements** uniquement par des fonctions de la base (`create_sale`, `record_payment`) qui vérifient le stock et les montants.
- **Gestion des comptes** par une fonction serveur (`admin-users`) réservée à l'administrateur de la pharmacie ; la clé de service ne quitte jamais le serveur.
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
2. Déployer les fonctions `admin-users` et `billing` (`supabase functions deploy admin-users`, puis `billing`).
3. Laisser l'inscription activée (Authentication → Sign In / Providers) : chaque pharmacie crée son compte, puis sa pharmacie, depuis l'application. Pour de vraies inscriptions, brancher un service d'envoi d'e-mails (SMTP) : celui fourni par défaut est limité à quelques messages par heure.

### Paiement en ligne (NabooPay ou PayDunya)

L'abonnement se paie par mobile money. Enregistrer les secrets du prestataire choisi dans Supabase (Edge Functions → Secrets) ; ils ne vont jamais dans le dépôt ni dans le navigateur.

| Secret | Valeur |
|---|---|
| `NABOOPAY_API_KEY` | clé d'API NabooPay (portée `checkout`) |
| `NABOOPAY_WEBHOOK_SECRET` | clé secrète du webhook NabooPay |
| `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN` | clés PayDunya |
| `PAYDUNYA_MODE` | `test` ou `live` |
| `APP_URL` | adresse publique du site, pour le retour après paiement |

Si les deux prestataires sont configurés, NabooPay sert aux nouveaux paiements. Adresse à déclarer comme webhook chez le prestataire : `https://<projet>.supabase.co/functions/v1/billing`.

Les offres et leurs prix sont dans la table `plans`.

Le paiement des ventes utilise, lui, la clé NabooPay de chaque pharmacie, saisie par son administrateur dans l'application (page Abonnement). Elle est chiffrée en base (Vault) et lue uniquement par la fonction `sale-payments`, à déployer comme les deux autres.

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
