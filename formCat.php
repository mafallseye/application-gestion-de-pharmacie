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
                <label for="names" class="form-label"> Name</label>
                <input type="text" name="names" placeholder=" Name" class="form-control">
            </div>
            <div class="mb-3 mt-3">
                <label for="short" class="form-label">Short Name</label>
                <input type="text" name="short" placeholder="Short Name" class="form-control">
            </div>
            <div class="mb-3 mt-3">
                <label for="create" class="form-label">Create Date</label>
                <input type="text" name="create" placeholder="Create Date" class="form-control">
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

        $a = $_POST['names'];
        $b = $_POST['short'];
        $c = $_POST['create'];



        $con = mysqli_connect('localhost', 'root', '');
        mysqli_select_db($con, 'pharmacie');
        $query = "INSERT INTO `category`( `names`, `short_name`, `create_date`)  VALUES ('$a','$b','$c')";
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