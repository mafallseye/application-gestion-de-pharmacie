<?php

$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$updatesql = $bdd->query("SELECT * FROM customers WHERE id=$id");
$stock = $updatesql->fetch();

if (isset($_POST['Envoyer'])) {
    $a = $_POST['names'];
    $b = $_POST['address'];
    $c = $_POST['telephone'];
    $d = $_POST['fax'];
    $e = $_POST['info'];


    $update = $bdd->query("UPDATE `suppliers` SET names='$a', addresse='$b', telephone='$c', fax='$d',info=$e WHERE id=$id");

    if ($stock) {
        header("location:formSup.php");
    } else {


?>
        <div class="alert alert-danger">
            <strong>danger!</strong> La mise à jour à echouer .
        </div>
<?php
    }
}

?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">

</head>

<body>
    <div class="contactez-nous">

        <p>Les sorties de stocks des medicaments restants</p>
        <form method="POST">
            <div class="mb-3 mt-3">
                <label for="names" class="form-label"> Name</label>
                <input type="text" name="names" placeholder=" Name" class="form-control" value="<?= $stock['names'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="address" class="form-label">Address</label>
                <input type="text" name="address" placeholder="Address" class="form-control" value="<?= $stock['addresse'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="telephone" class="form-label">Telephone</label>
                <input type="text" name="telephone" placeholder="Telephone" class="form-control" value="<?= $stock['telephone'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="fax" class="form-label">Fax</label>
                <input type="text" name="fax" placeholder="Fax" class="form-control" value="<?= $stock['fax'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="info" class="form-label">Info</label>
                <input type="text" name="info" placeholder="Info" class="form-control" value="<?= $stock['info'] ?>">
            </div>

            <div class="mb-3 mt-3">
                <button type="submit" name="Envoyer" class="btn btn-primary">Envoyer </button>
            </div>
        </form>
    </div>
</body>
<?php

$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$updatesql = $bdd->query("SELECT * FROM customers WHERE id=$id");
$stock = $updatesql->fetch();

if (isset($_POST['Envoyer'])) {
    $a = $_POST['names'];
    $b = $_POST['address'];
    $c = $_POST['telephone'];
    $d = $_POST['fax'];
    $e = $_POST['info'];


    $update = $bdd->query("UPDATE `customers` SET names='$a', addresse='$b', telephone='$c', fax='$d',info='$e' WHERE id=$id");

    if ($stock) {
        header("location:formCust.php");
    } else {


?>
        <div class="alert alert-danger">
            <strong>danger!</strong> La mise à jour à echouer .
        </div>
<?php
    }
}

?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">

</head>

<body>
    <div class="contactez-nous">

        <p>Les sorties de stocks des medicaments restants</p>
        <form method="POST">
            <div class="mb-3 mt-3">
                <label for="names" class="form-label"> Name</label>
                <input type="text" name="names" placeholder="Customer Name" class="form-control" value="<?= $stock['names'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="address" class="form-label">Address</label>
                <input type="text" name="address" placeholder="Address" class="form-control" value="<?= $stock['addresse'] ?>">
            </div>paid
            <div class="mb-3 mt-3">
                <label for="telephone" class="form-label">Telephone</label>
                <input type="text" name="telephone" placeholder="Telephone" class="form-control" value="<?= $stock['telephone'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="fax" class="form-label">Fax</label>
                <input type="text" name="fax" placeholder="Fax" class="form-control" value="<?= $stock['fax'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="info" class="form-label">Info</label>
                <input type="text" name="info" placeholder="Info" class="form-control" value="<?= $stock['info'] ?>">
            </div>

            <div class="mb-3 mt-3">
                <button type="submit" name="Envoyer" class="btn btn-primary">Envoyer </button>
            </div>
        </form>
    </div>
</body>

</html>
<style>
    div {
        width: 50%;
        box-sizing: border-box;
        margin-left: 30%;
    }
</style>

</html>
<style>
    div {
        width: 50%;
        box-sizing: border-box;
        margin-left: 30%;
    }
</style>