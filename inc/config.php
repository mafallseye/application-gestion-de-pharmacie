<?php
// Réglages de connexion à la base. Les valeurs viennent des variables
// d'environnement ; les valeurs par défaut sont celles d'un XAMPP/WAMP local.
return [
    'host' => getenv('DB_HOST') ?: 'localhost',
    'name' => getenv('DB_NAME') ?: 'pharmacie',
    'user' => getenv('DB_USER') ?: 'root',
    'pass' => getenv('DB_PASS') !== false ? getenv('DB_PASS') : '',
];
