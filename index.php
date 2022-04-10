<!doctype html>
<html lang="en">

<head>

	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">

	<!-- Bootstrap CSS -->
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">

	<title>Hello, world!</title>
	<!-- <script>
		function validateForm() {
			let x = document.forms["myForm"]["fname"].value;
			if (x == "") {
				alert("Name must be filled out");
				return false;
			}
		} -->
	</script>
</head>

<body>
	<div class="left">
		<img src="phar.jpg" class="rounded" alt="Cinque Terre">
	</div>
	<form method="POST" name="myForm" onsubmit="return validateForm()" method>
		<div class="mb-3 mt-3" class="right">
			<label for="email" class="form-label">Email:</label>
			<input type="email" class="form-control" id="email" placeholder="Enter email" name="fname" required>
		</div>
		<div class="mb-3">
			<label for="pwd" class="form-label">Password:</label>
			<input type="password" class="form-control" id="pwd" placeholder="Enter password" name="fname" required>
		</div>
		<div class="form-check mb-3">
			<label class="form-check-label">
				<input class="form-check-input" type="checkbox" name="remember" required> Remember me
			</label>
		</div>
		<button type="submit" class="btn btn-primary" name="valider">Submit</button>
	</form>
	<?php
	@$email = $_POST['email'];
	@$pass =  $_POST['pswd'];

	if (isset($_POST['valider'])) {
		if ($email = "maguettefseye@gmail.com" && $pass = "mafall97") {

			header('location:tableau.php');
		} else {
			echo "erreur";
		}
	}
	?>

	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>


</body>



<footer>
	<p>&copy; <?php echo date('Y'); ?> login form. All Rights Reserved | Design by M F S.</p>
</footer>

</body>

</html>
<style>
	* {
		box-sizing: border-box;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background: lightgray;
	}

	div {
		width: 30%;
		margin-left: 30%;

	}

	button {
		width: 10%;
		margin-left: 30%;
	}

	footer {
		margin-top: 100%;
		text-align: center;
	}
</style>