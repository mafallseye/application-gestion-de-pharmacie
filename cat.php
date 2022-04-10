<div id="demo">
    <?php
    $bdd = new PDO('mysql:host=localhost;dbname=pharmacie;', 'root', '');
    $allstoc = $bdd->query('SELECT * FROM category ORDER BY id ASC');
    if (isset($_GET['s']) and !empty($_GET['s'])) {
        $recherche = htmlspecialchars($_GET['s']);
        $allstoc = $bdd->query('SELECT names  FROM  category WHERE names LIKE "%' . $recherche . '%" ORDER BY id ASC');
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
                <a href="formCat.php">
                    <button class="btn btn-primary">
                        Ajouter un produit
                    </button>
                </a>
            </div>

            <table border="0" class="table table-striped mt-3 ">

                <tr>

                    <th>Name</th>
                    <th>Short Name</th>
                    <th>Create Date</th>
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
                            <p><?= $stock['short_name'] ?></p>
                        </td>
                        <td>
                            <p><?= $stock['create_date'] ?></p>
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

                                <a href="updateCat.php?id=<?= $stock['id'] ?>" class="m-2">
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
                                            <a href="deleteCat.php?id=<?= $stock['id'] ?>">
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
                                            <a href="deleteCat.php?id=<?= $stock['id'] ?>">
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