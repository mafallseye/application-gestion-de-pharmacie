<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
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
                        <a class="nav-link " href="tableauCustomers.php">Customers</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link " href="tableauSuppliers.php">Suppliers</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link " href="tableauUser.php">Users</a>
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

    <div>
        <?php
        $bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
        $allstoc = $bdd->query('SELECT * FROM customers ORDER BY id ASC');
        if (isset($_GET['s']) and !empty($_GET['s'])) {
            $recherche = htmlspecialchars($_GET['s']);
            $allstoc = $bdd->query('SELECT names  FROM  customers WHERE names LIKE "%' . $recherche . '%" ORDER BY id ASC');
        }


        if ($allstoc->rowCount() > 0) {
        ?>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">

            <link rel="stylesheet" href="table.css">
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>

            <script src="./table.js"></script>
            <form method="GET">
                <input type="search" id="search" autocomplete="off" name="s" onkeyup="searchTable()">
                <input type="submit" value="search" name="s">
            </form>
            <div class="container">
                <div class="row pt-3">
                    <a href="formCust.php">
                        <button class="btn btn-primary">
                            Ajouter un produit
                        </button>
                    </a>
                </div>

                <table border="0" class="table table-striped mt-3 ">

                    <tr>

                        <th> Name</th>
                        <th>Address</th>
                        <th>Telephone</th>
                        <th>Fax</th>
                        <th>Info</th>
                        <th>#id</th>
                        <th colspan="2">Control</th>
                    </tr>

                    <?php
                    while ($stock = $allstoc->fetch()) {
                    ?>

                        <tr>

                            <td scope="row">
                                <p><?= $stock['names'] ?></p>
                            </td>
                            <td>
                                <p><?= $stock['addresse'] ?></p>
                            </td>
                            <td>
                                <p><?= $stock['telephone'] ?></p>
                            </td>
                            <td>
                                <p><?= $stock['fax'] ?></p>
                            </td>
                            <td>
                                <p><?= $stock['info'] ?></p>
                            </td>

                            <td>
                                <p><?= $stock['id'] ?></p>
                            </td>
                            <td>
                                <!-- <a href="update.php?id=<?= $stock['id'] ?>" class="m-2">
                                <i class="fa fa-edit  fa-2x"></i>
                                <i class="fa fa-trash fa-2x red-icon" data-bs-toggle="modal" data-bs-target="#exempleModal<?= $stock['id'] ?>"></i>
                                <div class="modal fade" id="exempleModal<?= $stock['id'] ?>" role="dialog">
                                    <div class="modal-dialog">
                                        <div class="modal-content">
                                            <div class="modal-body">
                                                <p>Etes vous sur de sortir un produit?</p>
                                            </div>
                                            <div class="modal-footer">
                                                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                                                    Annuler
                                                </button>
                                                <a href="delete.php?id=<?= $stock['id'] ?>">
                                                    <button class="btn btn-danger">Confirmer</button>
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </a> -->
                                <!-- <input type="button" class="editer" value="Editer">
                            <input type="button" class="trash" value="Supprimer" name="trash"> -->
                                <div class="container mt-3">

                                    <a href="updateCust.php?id=<?= $stock['id'] ?>" class="m-2">
                                        <i class="fa fa-edit  fa-2x"></i>

                                        <i class="fa fa-trash fa-2x red-icon" data-bs-toggle="modal" data-bs-target="#myModal<?= $stock['id'] ?>"></i>

                                        <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#myModal<?= $stock['id']; ?>" role="dialog">
                                            <span class="glyphicon glyphicon-pencil"></span>
                                        </button>
                                        edit
                                </div>

                                <!-- The Modal -->
                                <div class="modal" id="myModal<?= $stock['id']; ?>">
                                    <div class="modal-dialog">
                                        <div class="modal-content">

                                            <!-- Modal Header -->
                                            <div class="modal-header">
                                                <h4 class="modal-title">Dite moi</h4>
                                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                            </div>
                                            <p>Etes vous sur de sortir un produit?</p>
                                            <!-- Modal body -->
                                            <div class="modal-body">

                                            </div>

                                            <!-- Modal footer -->
                                            <div class="modal-footer">
                                                <a href="botstrap.php">
                                                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                                                        Annuler
                                                    </button>
                                                </a>
                                                <a href="deleteCust.php?id=<?= $stock['id'] ?>">
                                                    <button class="btn btn-danger">Confirmer</button>
                                                </a>
                                                <!-- <button type="button" class="btn btn-danger" data-bs-dismiss="modal">Close</button> -->
                                            </div>
                                        </div>


                            </td>
                            <td>
                                <div class="container mt-3">


                                    <span class="glyphicon glyphicon-trash">
                                        <button type="button" class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#myModal<?= $stock['id']; ?>">

                                        </button>
                                        Trash</span>

                                </div>

                                <!-- The Modal -->
                                <div class="modal fade" id="myModal<?= $stock['id'] ?>">
                                    <div class="modal-dialog">
                                        <div class="modal-content">


                                            <div class="modal-header">
                                                <h4 class="modal-title">Modal Heading</h4>
                                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                            </div>

                                            <!-- Modal body -->
                                            <p>Etes vous sur de sortir un produit?</p>
                                            <div class="modal-body">
                                                Modal body..
                                            </div>

                                            <!-- Modal footer -->
                                            <div class="modal-footer">
                                                </button>
                                                <a href="deleteCust.php?id=<?= $stock['id'] ?>">
                                                    <button class="btn btn-danger">Confirmer</button>
                                                </a>

                                            </div>

                                        </div>
                                    </div>
                                </div>

                            </td>
                        <?php
                    }
                        ?>


                        </tr>
                </table>

            <?php
        } else {
            ?>
                <p>Aucun stocks trouver</p>


            <?php
        }


            ?>
            </div>
</body>

</html>