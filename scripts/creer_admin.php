<?php
// Crée un utilisateur (ou change son mot de passe) depuis le terminal :
//   php scripts/creer_admin.php adresse@exemple.com
// Élargit aussi la colonne du mot de passe si une ancienne base est trop étroite.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/../inc/app.php';

$email = $argv[1] ?? '';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Usage : php scripts/creer_admin.php adresse@exemple.com\n");
    exit(1);
}
$password = getenv('ADMIN_PASSWORD');
if ($password === false) {
    fwrite(STDOUT, 'Mot de passe (8 caractères au moins) : ');
    $password = rtrim((string) fgets(STDIN), "\r\n");
}
if (strlen($password) < 8) {
    fwrite(STDERR, "Mot de passe trop court.\n");
    exit(1);
}
if (!password_column_ok()) {
    db()->exec('ALTER TABLE `user` MODIFY passworde VARCHAR(255) NOT NULL');
    echo "Colonne du mot de passe élargie.\n";
}
$st = db()->prepare('SELECT id FROM `user` WHERE email = ?');
$st->execute([$email]);
$id = $st->fetchColumn();
if ($id) {
    save_password((int) $id, $password);
    echo "Mot de passe mis à jour pour $email.\n";
} else {
    $st = db()->prepare('INSERT INTO `user` (email, passworde, group_name) VALUES (?, ?, ?)');
    $st->execute([$email, password_hash($password, PASSWORD_DEFAULT), 'admin']);
    echo "Utilisateur $email créé.\n";
}
