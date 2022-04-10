<?php
$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$delsql = $bdd->query("DELETE FROM category WHERE id='$id'");
if ($delsql) {
    header("location:botstrap.php");
} else {
    echo "failed";
}
