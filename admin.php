<!DOCTYPE html>
<html class="loading" lang="en" data-textdirection="ltr">
<!-- BEGIN: Head-->

<head>
  <link rel="stylesheet" href="./s.css">


  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">

  <title>pharmacy</title>
</head>

<body>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>


  <nav>

    <ul>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <li class="dashboard"><a href="#" onclick="document.getElementById('demo').style.display='block'">Dashboard</a>
      </li>
      <li class="menu-deroulant">
        <a href="#">Medecinals</a>
        <ul class="sous-menu">
          <li class="dashboard"><a href="#" onclick="document.getElementById('demo').style.display='block'">Manage</a></li>
          <li><a href="#">Out Stocks</a></li>
          <li><a href="#">Expired</a></li>
        </ul>
      </li>
      <li>
        <a href="#">Pos</a>
      </li>
      <li><a href="#">Sales</a></li>
      <li>
        <a href="#">Categories</a>
      </li>
      <li><a href="#">Customers</a></li>
      <li><a href="#">Suppliers</a></li>
      <li> <a href="#">Users</a></li>
      <li class="menu-deroulant">
        <a href="#">Reports</a>
        <ul class="sous-menu">
          <li><a href="#">Sales Report</a></li>
          <li><a href="#">Purchase Report</a></li>
          <li><a href="#">Customers Report</a></li>
          <li><a href="#">Purchase expiry Report</a></li>
        </ul>
      </li>
      <li><a href="#">Settings</a></li>
    </ul>
  </nav>
  <?php
  require_once('tableau.php');
  ?>
  <script src="./dash.js"></script>
</body>

</html>