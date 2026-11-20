<?php
// Socle commun : session, base de données, protections, pages génériques.
declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

/* ---------- Session et en-têtes de sécurité ---------- */

if (PHP_SAPI !== 'cli') {
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_name('pharmacie');
    session_start();
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'");
}

/* ---------- Base de données ---------- */

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = require __DIR__ . '/config.php';
        try {
            $pdo = new PDO(
                "mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4",
                $c['user'],
                $c['pass'],
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            error_log('Connexion base impossible : ' . $e->getMessage());
            http_response_code(500);
            exit('Le service est momentanément indisponible.');
        }
    }
    return $pdo;
}

/* ---------- Outils ---------- */

/** Échappe une valeur avant de l'afficher dans du HTML. */
function e($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function redirect(string $page): void
{
    header('Location: ' . $page);
    exit;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

/** Refuse toute requête POST dont le jeton ne correspond pas à la session. */
function csrf_check(): void
{
    $sent = $_POST['csrf'] ?? '';
    if (!is_string($sent) || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        http_response_code(400);
        exit('Requête refusée : formulaire expiré. Revenez en arrière et réessayez.');
    }
}

function is_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

function require_login(): void
{
    if (empty($_SESSION['user_id'])) {
        redirect('index.php');
    }
}

function flash(?string $message = null): ?string
{
    if ($message !== null) {
        $_SESSION['flash'] = $message;
        return null;
    }
    $m = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $m;
}

/* ---------- Connexion des utilisateurs ---------- */

/** La colonne doit pouvoir contenir un mot de passe haché (60 caractères au moins). */
function password_column_ok(): bool
{
    $st = db()->prepare(
        "SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'passworde'"
    );
    $st->execute();
    return (int) $st->fetchColumn() >= 60;
}

/**
 * Vérifie l'e-mail et le mot de passe. Renvoie l'identifiant de l'utilisateur ou null.
 * Un ancien mot de passe enregistré en clair est accepté une dernière fois, puis haché.
 */
function attempt_login(string $email, string $password): ?int
{
    $st = db()->prepare('SELECT id, passworde FROM `user` WHERE email = ? LIMIT 1');
    $st->execute([$email]);
    $user = $st->fetch();
    if (!$user) {
        password_verify($password, '$2y$10$vmdDZXYYJISFW2fpIyoChevlsScl8Rs4N16NCDXIWr0TyBjA5KIP2'); // temps constant
        return null;
    }
    $stored = (string) $user['passworde'];
    $isHash = password_get_info($stored)['algo'] !== null;
    if ($isHash) {
        if (!password_verify($password, $stored)) {
            return null;
        }
        if (password_needs_rehash($stored, PASSWORD_DEFAULT)) {
            save_password((int) $user['id'], $password);
        }
    } else {
        if ($stored === '' || !hash_equals($stored, $password)) {
            return null;
        }
        if (password_column_ok()) {
            save_password((int) $user['id'], $password);
        }
    }
    return (int) $user['id'];
}

function save_password(int $id, string $password): void
{
    $st = db()->prepare('UPDATE `user` SET passworde = ? WHERE id = ?');
    $st->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
}

/* ---------- Description des tableaux ---------- */

/**
 * Seuls les tableaux et colonnes listés ici peuvent être lus ou modifiés :
 * aucun nom de table ou de colonne ne vient de la requête du navigateur.
 */
function entities(): array
{
    $contact = [
        'names'     => ['Name', 'text'],
        'addresse'  => ['Address', 'text'],
        'telephone' => ['Telephone', 'text'],
        'fax'       => ['Fax', 'text'],
        'info'      => ['Info', 'text'],
    ];
    return [
        'out_stock' => [
            'title' => 'Médicaments', 'add' => 'Ajouter un produit',
            'list' => 'tableau.php', 'create' => 'out_stocks.php', 'update' => 'update.php', 'delete' => 'delete.php',
            'fields' => [
                'brand_name'   => ['Brand', 'text'],
                'genetic_name' => ['Genetic', 'text'],
                'category'     => ['Category', 'text'],
                'price'        => ['Price', 'number'],
                'quantity'     => ['Quantity', 'number'],
                'expire'       => ['Expire', 'text'],
            ],
        ],
        'sales' => [
            'title' => 'Ventes', 'add' => 'Ajouter une vente',
            'list' => 'tableauSal.php', 'create' => 'formSal.php', 'update' => 'updatesal.php', 'delete' => 'deleteSal.php',
            'fields' => [
                'customers_name' => ['Customer', 'text'],
                'grand_total'    => ['Grand total', 'number'],
                'paid_amount'    => ['Paid amount', 'number'],
                'added_date'     => ['Added date', 'text'],
            ],
        ],
        'category' => [
            'title' => 'Catégories', 'add' => 'Ajouter une catégorie',
            'list' => 'tableauCat.php', 'create' => 'formCat.php', 'update' => 'updateCat.php', 'delete' => 'deleteCat.php',
            'fields' => [
                'names'       => ['Name', 'text'],
                'short_name'  => ['Short name', 'text'],
                'create_date' => ['Create date', 'text'],
            ],
        ],
        'customers' => [
            'title' => 'Clients', 'add' => 'Ajouter un client',
            'list' => 'tableauCustomers.php', 'create' => 'formCust.php', 'update' => 'updateCust.php', 'delete' => 'deleteCust.php',
            'fields' => $contact,
        ],
        'suppliers' => [
            'title' => 'Fournisseurs', 'add' => 'Ajouter un fournisseur',
            'list' => 'tableauSuppliers.php', 'create' => 'formSup.php', 'update' => 'updateSup.php', 'delete' => 'deleteSup.php',
            'fields' => $contact,
        ],
        'user' => [
            'title' => 'Utilisateurs', 'add' => 'Ajouter un utilisateur',
            'list' => 'tableauUser.php', 'create' => 'AddUser.php', 'update' => 'updateUser.php', 'delete' => 'deleteUser.php',
            'fields' => [
                'email'      => ['Email', 'email'],
                'passworde'  => ['Password', 'password'],
                'group_name' => ['Group name', 'text'],
            ],
        ],
    ];
}

/* ---------- Mise en page ---------- */

function page_header(string $title, bool $withNav = true): void
{
    ?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($title) ?> — Pharmacy</title>
    <link rel="stylesheet" href="assets/bootstrap.min.css">
    <link rel="stylesheet" href="table.css">
</head>
<body>
<?php if ($withNav) { ?>
    <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <div class="container-fluid">
            <a class="navbar-brand" href="tableau.php">PHARMACY</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu" aria-controls="menu" aria-expanded="false" aria-label="Ouvrir le menu">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="menu">
                <ul class="navbar-nav me-auto">
                    <li class="nav-item"><a class="nav-link" href="tableau.php">Dashboard</a></li>
                    <li class="nav-item"><a class="nav-link" href="tableauSal.php">Sals</a></li>
                    <li class="nav-item"><a class="nav-link" href="tableauCat.php">Category</a></li>
                    <li class="nav-item"><a class="nav-link" href="tableauCustomers.php">Customers</a></li>
                    <li class="nav-item"><a class="nav-link" href="tableauSuppliers.php">Suppliers</a></li>
                    <li class="nav-item"><a class="nav-link" href="tableauUser.php">Users</a></li>
                </ul>
                <form method="POST" action="logout.php" class="logout">
                    <?= csrf_field() ?>
                    <button type="submit" class="btn btn-outline-secondary btn-sm">Se déconnecter</button>
                </form>
            </div>
        </div>
    </nav>
<?php } ?>
    <main class="container py-3">
<?php
    $message = flash();
    if ($message !== null) {
        echo '<div class="alert alert-success">' . e($message) . '</div>';
    }
}

function page_footer(): void
{
    ?>
    </main>
    <script src="assets/bootstrap.bundle.min.js"></script>
    <script src="table.js"></script>
</body>
</html>
<?php
}

/* ---------- Pages génériques ---------- */

/** Liste d'un tableau, avec recherche sur la première colonne. */
function page_list(string $key): void
{
    require_login();
    $ent = entities()[$key];
    $fields = $ent['fields'];
    $first = array_key_first($fields);
    $search = isset($_GET['s']) && is_string($_GET['s']) ? trim($_GET['s']) : '';

    if ($search !== '') {
        $like = '%' . addcslashes($search, '%_\\') . '%';
        $st = db()->prepare("SELECT * FROM `$key` WHERE `$first` LIKE ? ORDER BY id ASC");
        $st->execute([$like]);
    } else {
        $st = db()->query("SELECT * FROM `$key` ORDER BY id ASC");
    }
    $rows = $st->fetchAll();

    page_header($ent['title']);
    ?>
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 class="h4 m-0"><?= e($ent['title']) ?></h1>
        <form method="GET" class="d-flex gap-2 search">
            <input type="search" id="search" name="s" class="form-control" autocomplete="off" placeholder="Rechercher" value="<?= e($search) ?>">
            <button type="submit" class="btn btn-secondary">Rechercher</button>
        </form>
        <a href="<?= e($ent['create']) ?>" class="btn btn-primary"><?= e($ent['add']) ?></a>
    </div>
<?php if (!$rows) { ?>
    <p>Aucun résultat.</p>
<?php } else { ?>
    <table class="table table-striped">
        <tr>
<?php foreach ($fields as $col => [$label, $type]) { if ($type === 'password') { continue; } ?>
            <th><?= e($label) ?></th>
<?php } ?>
            <th>#id</th>
            <th colspan="2">Control</th>
        </tr>
<?php foreach ($rows as $row) { ?>
        <tr>
<?php foreach ($fields as $col => [$label, $type]) { if ($type === 'password') { continue; } ?>
            <td><?= e($row[$col] ?? '') ?></td>
<?php } ?>
            <td><?= e($row['id']) ?></td>
            <td><a class="btn btn-sm btn-primary" href="<?= e($ent['update']) ?>?id=<?= (int) $row['id'] ?>">Modifier</a></td>
            <td>
                <form method="POST" action="<?= e($ent['delete']) ?>" class="inline" data-confirm="Supprimer cette ligne ?">
                    <?= csrf_field() ?>
                    <input type="hidden" name="id" value="<?= (int) $row['id'] ?>">
                    <button type="submit" class="btn btn-sm btn-danger">Supprimer</button>
                </form>
            </td>
        </tr>
<?php } ?>
    </table>
<?php }
    page_footer();
}

/** Lit et contrôle les champs envoyés. Renvoie [valeurs, erreurs]. */
function read_fields(array $fields, bool $creating): array
{
    $values = [];
    $errors = [];
    foreach ($fields as $col => [$label, $type]) {
        $raw = $_POST[$col] ?? '';
        $v = is_string($raw) ? trim($raw) : '';
        if ($type === 'password') {
            $v = is_string($raw) ? $raw : '';
            if ($v === '' && !$creating) {
                continue; // vide en modification : mot de passe inchangé
            }
            if (strlen($v) < 8) {
                $errors[$col] = 'Le mot de passe doit contenir au moins 8 caractères.';
            }
            $values[$col] = $v;
            continue;
        }
        if ($v === '') {
            $errors[$col] = "$label est obligatoire.";
        } elseif (mb_strlen($v) > 255) {
            $errors[$col] = "$label est trop long (255 caractères au plus).";
        } elseif ($type === 'email' && !filter_var($v, FILTER_VALIDATE_EMAIL)) {
            $errors[$col] = "L'adresse e-mail n'est pas valide.";
        } elseif ($type === 'number' && !is_numeric($v)) {
            $errors[$col] = "$label doit être un nombre.";
        }
        $values[$col] = $v;
    }
    return [$values, $errors];
}

/** Formulaire d'ajout (sans id) ou de modification (avec ?id=). */
function page_form(string $key, bool $editing): void
{
    require_login();
    $ent = entities()[$key];
    $fields = $ent['fields'];
    $id = null;
    $current = [];

    if ($editing) {
        $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
        if (!$id) {
            redirect($ent['list']);
        }
        $st = db()->prepare("SELECT * FROM `$key` WHERE id = ?");
        $st->execute([$id]);
        $current = $st->fetch() ?: null;
        if ($current === null) {
            redirect($ent['list']);
        }
    }

    $errors = [];
    $values = $current;
    if (is_post()) {
        csrf_check();
        [$values, $errors] = read_fields($fields, !$editing);
        if ($key === 'user' && !$errors) {
            if (isset($values['passworde']) && !password_column_ok()) {
                $errors['passworde'] = 'La base doit être mise à jour avant d\'enregistrer un mot de passe (voir le README, « Mise à jour »).';
            }
            $st = db()->prepare('SELECT id FROM `user` WHERE email = ? AND id <> ?');
            $st->execute([$values['email'], $id ?? 0]);
            if ($st->fetch()) {
                $errors['email'] = 'Cette adresse e-mail est déjà utilisée.';
            }
        }
        if (!$errors) {
            if (isset($values['passworde'])) {
                $values['passworde'] = password_hash($values['passworde'], PASSWORD_DEFAULT);
            }
            $cols = array_keys($values);
            if ($editing) {
                $set = implode(', ', array_map(fn ($c) => "`$c` = ?", $cols));
                $st = db()->prepare("UPDATE `$key` SET $set WHERE id = ?");
                $st->execute([...array_values($values), $id]);
                flash('Modification enregistrée.');
            } else {
                $names = implode(', ', array_map(fn ($c) => "`$c`", $cols));
                $marks = implode(', ', array_fill(0, count($cols), '?'));
                $st = db()->prepare("INSERT INTO `$key` ($names) VALUES ($marks)");
                $st->execute(array_values($values));
                flash('Ajout enregistré.');
            }
            redirect($ent['list']);
        }
    }

    page_header($editing ? 'Modifier' : $ent['add']);
    ?>
    <h1 class="h4"><?= e($editing ? 'Modifier — ' . $ent['title'] : $ent['add']) ?></h1>
    <form method="POST" class="edit" novalidate>
        <?= csrf_field() ?>
<?php foreach ($fields as $col => [$label, $type]) {
        $isPassword = $type === 'password'; ?>
        <div class="mb-3">
            <label for="f-<?= e($col) ?>" class="form-label"><?= e($label) ?></label>
            <input type="<?= $isPassword ? 'password' : ($type === 'email' ? 'email' : 'text') ?>"
                   id="f-<?= e($col) ?>" name="<?= e($col) ?>"
                   class="form-control<?= isset($errors[$col]) ? ' is-invalid' : '' ?>"
                   <?= $isPassword ? 'autocomplete="new-password"' : 'value="' . e($values[$col] ?? '') . '"' ?>>
<?php if ($isPassword && $editing) { ?>
            <div class="form-text">Laisser vide pour garder le mot de passe actuel.</div>
<?php } ?>
<?php if (isset($errors[$col])) { ?>
            <div class="invalid-feedback"><?= e($errors[$col]) ?></div>
<?php } ?>
        </div>
<?php } ?>
        <button type="submit" name="Envoyer" class="btn btn-primary">Envoyer</button>
        <a href="<?= e($ent['list']) ?>" class="btn btn-outline-secondary">Annuler</a>
    </form>
<?php
    page_footer();
}

/** Suppression : uniquement en POST, avec jeton de formulaire. */
function page_delete(string $key): void
{
    require_login();
    $ent = entities()[$key];
    if (!is_post()) {
        redirect($ent['list']);
    }
    csrf_check();
    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
    if ($id) {
        if ($key === 'user' && $id === (int) $_SESSION['user_id']) {
            flash('Vous ne pouvez pas supprimer votre propre compte.');
            redirect($ent['list']);
        }
        $st = db()->prepare("DELETE FROM `$key` WHERE id = ?");
        $st->execute([$id]);
        flash('Suppression effectuée.');
    }
    redirect($ent['list']);
}
