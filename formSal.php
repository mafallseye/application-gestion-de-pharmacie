<!DOCTYPE html>
<html>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SALS</title>
    <div class="contactez-nous">


        <form method="POST">
            <div class="mb-3 mt-3">
                <label for="customer" class="form-label">Customer Name</label>
                <input type="text" name="customer" placeholder="Customer Name" class="form-control">
            </div>
            <div class="mb-3 mt-3">
                <label for="grand" class="form-label">Grand Total</label>
                <input type="text" name="grand" placeholder="Grand total" class="form-control">
            </div>
            <div class="mb-3 mt-3">
                <label for="paid" class="form-label">Paid Amount</label>
                <input type="text" name="paid" placeholder="Paid Amount" class="form-control">
            </div>
            <div class="mb-3 mt-3">
                <label for="added" class="form-label">Aded Date</label>
                <input type="text" name="added" placeholder="Added date" class="form-control">
            </div>
            <div class="mb-3 mt-3">
                <button type="submit" name="Envoyer" class="btn btn-primary">Envoyer </button>
            </div>
        </form>
    </div>
</head>

<body>
    <?php
    if (isset($_POST['Envoyer'])) {

        $a = $_POST['customer'];
        $b = $_POST['grand'];
        $c = $_POST['paid'];
        $d = $_POST['added'];


        $con = mysqli_connect('localhost', 'root', '');
        mysqli_select_db($con, 'pharmacie');
        $query = "INSERT INTO `sales`( `customers_name`, `grand_total`, `paid_amount`, `added_date`)  VALUES ('$a','$b','$c','$d')";
        mysqli_query($con, $query);
        if ($query) {
    ?>
            <div class="alert alert-success">
                <strong>Success!</strong> You should <a href="#" class="alert-link">read this message</a>.
            </div>
    <?php
        }
    }

    ?>


    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>

</body>

</html>
<style>
    div {
        width: 50%;
        box-sizing: border-box;
        margin-left: 30%;
    }
</style>