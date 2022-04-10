<?php

$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$updatesql = $bdd->query("SELECT * FROM category WHERE id=$id");
$stock = $updatesql->fetch();

if (isset($_POST['Envoyer'])) {
    $a = $_POST['names'];
    $b = $_POST['short'];
    $c = $_POST['create'];
    $update = $bdd->query("UPDATE `category` SET  names='$a', short_name='$b', create_date='$c' WHERE id=$id");

    if ($stock) {
        header("location:formCat.php");
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


        <form method="POST">
            <div class="mb-3 mt-3">
                <label for="names" class="form-label"> Name</label>
                <input type="text" name="names" placeholder=" Name" class="form-control" value="<?= $stock['names'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="short" class="form-label">Short Name</label>
                <input type="text" name="short" placeholder="Short Name" class="form-control" value="<?= $stock['short_name'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="create" class="form-label">Create Date</label>
                <input type="text" name="create" placeholder="Create Date" class="form-control" value="<?= $stock['create_date'] ?>">
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