<?php
$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$delsql = $bdd->query("DELETE FROM suppliers WHERE id='$id'");
if ($delsql) {
    header("location:tableauSuppliers.php");
} else {
    echo "failed";
}
