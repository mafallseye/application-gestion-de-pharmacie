<?php

$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$updatesql = $bdd->query("SELECT * FROM out_stock WHERE id=$id");
$stock = $updatesql->fetch();

if (isset($_POST['Envoyer'])) {
    $a = $_POST['Brand'];
    $b = $_POST['Genetic'];
    $c = $_POST['category'];
    $d = $_POST['Price'];
    $e = $_POST['quantity'];
    $f = $_POST['expire'];

    $update = $bdd->query("UPDATE `out_stock` SET brand_name='$a', genetic_name='$b', category='$c', price='$d', quantity='$e', expire='$f' WHERE id=$id");

    if ($stock) {
        header("location:out_stocks.php");
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
                <label for="Brand" class="form-label">Brand Name</label>
                <input type="text" name="Brand" placeholder="Brand Name" class="form-control" value="<?= $stock['brand_name'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="Genetic" class="form-label">Genetic Name</label>
                <input type="text" name="Genetic" placeholder="Genetic Name" class="form-control" value="<?= $stock['genetic_name'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="Category" class="form-label">Category</label>
                <input type="text" name="category" placeholder="Category" class="form-control" value="<?= $stock['category'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="Price" class="form-label">Price</label>
                <input type="text" name="Price" placeholder="Price" class="form-control" value="<?= $stock['price'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="Quantity" class="form-label">Quantity</label>
                <input type="text" name="quantity" placeholder="Quantity" class="form-control" value="<?= $stock['quantity'] ?>">
            </div>
            <div>
                <label for="Expire" class="form-label">Expire</label>
                <input type="text" name="expire" placeholder="Expire" class="form-control" value="<?= $stock['expire'] ?>">
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