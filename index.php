<?php
require __DIR__ . '/inc/app.php';

if (!empty($_SESSION['user_id'])) {
    redirect('tableau.php');
}

$error = null;
if (is_post()) {
    csrf_check();
    $email = is_string($_POST['email'] ?? null) ? trim($_POST['email']) : '';
    $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';

    // Frein aux essais répétés : 5 échecs, puis 5 minutes d'attente.
    $tries = $_SESSION['login_tries'] ?? 0;
    $until = $_SESSION['login_blocked_until'] ?? 0;
    if (time() < $until) {
        $error = 'Trop de tentatives. Réessayez dans quelques minutes.';
    } else {
        $id = ($email !== '' && $password !== '') ? attempt_login($email, $password) : null;
        if ($id !== null) {
            session_regenerate_id(true);
            $_SESSION = ['user_id' => $id];
            redirect('tableau.php');
        }
        $tries++;
        $_SESSION['login_tries'] = $tries;
        if ($tries >= 5) {
            $_SESSION['login_blocked_until'] = time() + 300;
            $_SESSION['login_tries'] = 0;
        }
        $error = 'E-mail ou mot de passe incorrect.';
    }
}

page_header('Connexion', false);
?>
    <div class="login">
        <img src="phar.jpg" class="rounded img-fluid mb-3" alt="Pharmacie">
        <h1 class="h4">Connexion</h1>
<?php if ($error !== null) { ?>
        <div class="alert alert-danger"><?= e($error) ?></div>
<?php } ?>
        <form method="POST" class="edit">
            <?= csrf_field() ?>
            <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <input type="email" class="form-control" id="email" name="email" autocomplete="username" required>
            </div>
            <div class="mb-3">
                <label for="password" class="form-label">Mot de passe</label>
                <input type="password" class="form-control" id="password" name="password" autocomplete="current-password" required>
            </div>
            <button type="submit" class="btn btn-primary">Se connecter</button>
        </form>
    </div>
<?php
page_footer();
