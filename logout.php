<?php
require __DIR__ . '/inc/app.php';
if (is_post()) {
    csrf_check();
    $_SESSION = [];
    session_destroy();
}
redirect('index.php');
