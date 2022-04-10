<?php

$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
$id = $_GET['id'];
$updatesql = $bdd->query("SELECT * FROM sales WHERE id=$id");
$stock = $updatesql->fetch();

if (isset($_POST['Envoyer'])) {
    $a = $_POST['customer'];
    $b = $_POST['grand'];
    $c = $_POST['paid'];
    $d = $_POST['added'];


    $update = $bdd->query("UPDATE `sales` SET customers_name='$a', grand_total='$b', paid_amount='$c', added_date='$d' WHERE id=$id");

    if ($stock) {
        header("location:formSal.php");
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
                <label for="customer" class="form-label">Customer Name</label>
                <input type="text" name="customer" placeholder="Customer Name" class="form-control" value="<?= $stock['customers_name'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="grand" class="form-label">Grand total</label>
                <input type="text" name="grand" placeholder="Grand total" class="form-control" value="<?= $stock['grand_total'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="paid" class="form-label">Paid Amount</label>
                <input type="text" name="paid" placeholder="Paid Amount" class="form-control" value="<?= $stock['paid_amount'] ?>">
            </div>
            <div class="mb-3 mt-3">
                <label for="added" class="form-label">Added date</label>
                <input type="text" name="added" placeholder="Added date" class="form-control" value="<?= $stock['added_date'] ?>">
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