<?php
$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$delsql = $bdd->query("DELETE FROM sales WHERE id='$id'");
if ($delsql) {
    header("location:tableauSal.php");
} else {
    echo "failed";
}
