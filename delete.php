<?php
$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$delsql = $bdd->query("DELETE FROM out_stock WHERE id='$id'");
if ($delsql) {
    header("location:out_stocks.php");
} else {
    echo "failed";
}
