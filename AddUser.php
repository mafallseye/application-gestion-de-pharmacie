<?php

$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');

$updatesql = $bdd->query("SELECT * FROM user WHERE id=1");
$stock = $updatesql->fetch();

if (isset($_POST['Envoyer'])) {
    $a = $_POST['email'];
    $b = $_POST['password'];
    $c = $_POST['group'];



    $update = $bdd->query("UPDATE `user` SET email='$a', passworde='$b', group_name='$c' WHERE id=1");

    if ($stock) {
        header("location:tableauUser.php");
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
                <label for="email" class="form-label">Email</label>
                <input type="text" name="email" placeholder="Email" class="form-control" value="<?= $stock['email'] ?>">

                <label for="password" class="form-label">Password</label>
                <input type="text" name="password" placeholder="PassWord" class="form-control" value="<?= $stock['passworde'] ?>">
            </div>
            <div class="mb-3 mt-3" id="droite">
                <label for="group" class="form-label">Groupe Name</label>
                <input type="text" name="group" placeholder="Groupe Name" class="form-control" value="<?= $stock['group_name'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <button type="submit" name="Envoyer" class="btn btn-primary">Envoyer </button>

                <button type="reset" name="Cancel" class="btn btn-primary" style="background-color: red;">Cancel </button>
            </div>
        </form>
    </div>
</body>

</html>
<style>
    * {
        /* width: 50%; */
        box-sizing: border-box;
        /* margin-left: 30%; */
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    div {
        float: left;
        width: 50%;
        margin-left: 50px;

    }
</style>