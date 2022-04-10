<!DOCTYPE html>
<html>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>outStock</title>
  <div class="contactez-nous">

    <p>Les sorties de stocks des medicaments restants</p>
    <form method="POST">
      <div class="mb-3 mt-3">
        <label for="Brand" class="form-label">Brand Name</label>
        <input type="text" name="Brand" placeholder="Brand Name" class="form-control">
      </div>
      <div class="mb-3 mt-3">
        <label for="Genetic" class="form-label">Genetic Name</label>
        <input type="text" name="Genetic" placeholder="Genetic Name" class="form-control">
      </div>
      <div class="mb-3 mt-3">
        <label for="Category" class="form-label">Category</label>
        <input type="text" name="category" placeholder="Category" class="form-control">
      </div>
      <div class="mb-3 mt-3">
        <label for="Price" class="form-label">Price</label>
        <input type="text" name="Price" placeholder="Price" class="form-control">
      </div>
      <div class="mb-3 mt-3">
        <label for="Quantity" class="form-label">Quantity</label>
        <input type="text" name="quantity" placeholder="Quantity" class="form-control">
      </div>
      <div>
        <label for="Expire" class="form-label">Expire</label>
        <input type="text" name="expire" placeholder="Expire" class="form-control">
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

    $a = $_POST['Brand'];
    $b = $_POST['Genetic'];
    $c = $_POST['category'];
    $d = $_POST['Price'];
    $e = $_POST['quantity'];
    $f = $_POST['expire'];

    $con = mysqli_connect('localhost', 'root', '');
    mysqli_select_db($con, 'pharmacie');
    $query = "INSERT INTO `out_stock`( brand_name, genetic_name, category, price, quantity, expire) VALUES ('$a','$b','$c','$d','$e','$f')";
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