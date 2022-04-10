<?php
$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$delsql = $bdd->query("DELETE FROM user WHERE id='$id'");
if ($delsql) {
    header("location:tableauUser.php");
} else {
    echo "failed";
}
