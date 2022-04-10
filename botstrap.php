<!doctype html>
<html lang="en">

<head>
  <!-- <link rel="stylesheet" href="s.css"> -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">

  <title>document</title>

  <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
  <script>
    // $(function() {

    //   $(".dashboard").click(function() {
    //     $(".demo").show();
    //     // $("span.sales").hide();
    //   });
    // });
    // $(function() {

    //   $("div.sale").click(function() {
    //     $("span.sales").show();
    //     // $(".demo").hide();

    //   });
    // });
  </script>
</head>

<body>
  <nav class="navbar navbar-expand-lg navbar-light bg-light">
    <div class="container-fluid">
      <a class="navbar-brand" href="#">PHARMACY</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNavDropdown">
        <ul class="navbar-nav">
          <li class="nav-item" class="dashboard">
            <a class="nav-link " aria-current="page" href="tableau.php">
              <span class="dashboard">Dashboard</span></a>
          </li>
          <li class=" nav-item dropdown">
            <a class="nav-link dropdown-toggle " href="#" id="navbarDropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              Medecinals
            </a>
            <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink">
              <li><a class="dropdown-item" href="#">Manage</a></li>
              <li><a class="dropdown-item" href="#">Out_stocks</a></li>
              <li><a class="dropdown-item" href="#">Expire</a></li>
            </ul>
          </li>
          <li class="nav-item">
            <a class="nav-link " href="#">Pos</a>
          </li>
          <li class="nav-item">
            <a class="nav-link " href="tableauSal.php"><span class="sale" onclick="document.querySelector('.sales').display='block'">Sals</span></a>
          </li>
          <li class=" nav-item">
            <a class="nav-link " href="tableauCat.php">Category</a>
          </li>
          <li class="nav-item">
            <a class="nav-link " href="#">Customers</a>
          </li>
          <li class="nav-item">
            <a class="nav-link " href="#">Suppliers</a>
          </li>
          <li class="nav-item">
            <a class="nav-link " href="#">Users</a>
          </li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle " href="#" id="navbarDropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              Reports
            </a>
            <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink">
              <li><a class="dropdown-item" href="#">Sals Reports</a></li>
              <li><a class="dropdown-item" href="#">Purchase Reports</a></li>
              <li><a class="dropdown-item" href="#">Customers Reports</a></li>
              <li><a class="dropdown-item" href="#"> Expiry Report</a></li>
            </ul>
          </li>
          <li class="nav-item">
            <a class="nav-link " href="#">Settings</a>
          </li>
        </ul>

      </div>
    </div>
  </nav>


  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>

  <?php
  // require_once('tableau.php');
  // require_once('tableauSal.php');
  ?>

</body>


</html>