const textd = document.querySelectorAll("tr");
console.log(textd);
textd.forEach((textd) => {
  textd.addEventListener("click", () => {
    console.log("click !");
    textd.classList.add("text");
  });
});
//search dans le console

// const inputName = document.querySelector('input[type="search"]');
// inputName.addEventListener("input", (e) => {
//   console.log(e.target.value);
// });
function searchTable() {
  let input, filter, table, tr, td, textValue;
  input = document.getElementById("search");
  filter = input.value.toUpperCase();
  table = document.querySelector("table");
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
