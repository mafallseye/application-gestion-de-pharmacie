<?php
$bdd = new PDO('mysql:host=localhost;dbname=pharmacie;','root','');
$allstoc=$bdd->query('SELECT * FROM out_stock ORDER BY id DESC');
if (isset($_GET['s']) AND !empty($_GET['s'])) {
$recherche=htmlspecialchars($_GET['s']);
$allstoc=$bdd->query('SELECT brand_name  FROM  out_stock WHERE brand_name LIKE "%'.$recherche.'%" ORDER BY id DESC');
}
 ?>
 <!DOCTYPE html>
 <html>
 <head>
 	<title>chercher medicament</title>
 	<meta charset="utf-8">
 </head>
 <body>
 	<form method="GET">
 		 <input type="search" name="s" placeholder="recherche medicament" autocomplete="off">
 <input type="submit" name="rechercher">
 	</form>
<section class="recherche_medicament">
	<?php 
    if ($allstoc->rowCount() > 0) {
    	while ($stock=$allstoc->fetch()) {
    	
    		?>
    		<p><?=$stock['brand_name'] ?></p>
    		<?php
    	}
    }else {
    	?>
    	<p>Aucun stocks trouver</p>
    	<?php
    }
	?>
</section>
 </body>
 </html>