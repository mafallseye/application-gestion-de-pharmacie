<!DOCTYPE html>
<html>

<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>dashboard</title>
  <link rel="stylesheet" href="./table.css">

</head>

<body>

  <form method="GET">
    <input type="search" id="search" autocomplete="off" name="s">
    <input type="submit" value="search" name="s">
  </form>
  <?php require_once('./tableau.php'); ?>


  <script src="./table.js">
    function searchTable() {
      let input, filter, table, tr, td, textValue;
      input = document.getElementById("search");
      filter = input.value.toUpperCase();
      table = document.querySelector('table');
      tr = table.getElementsByTagName("tr");
      for (let i = 0; i < tr.length; i++) {
        // console.log("it is work");
        td = tr[i].getElementsByTagName("td")[0];
        if (td) {
          textValue = td.textContent || td.innerText;
          if (textValue.toUpperCase().indexOf(filter) > -1) {
            tr[i].style.display = "";
          } else {
            tr[i].style.display = "none";
          }
        }
      }
    }
  </script>
</body>

</html>