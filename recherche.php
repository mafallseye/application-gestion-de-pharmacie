<?php
require __DIR__ . '/inc/app.php';
require_login();
redirect('tableau.php' . (isset($_GET['s']) && is_string($_GET['s']) ? '?s=' . rawurlencode($_GET['s']) : ''));
