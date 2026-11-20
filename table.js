// Demande une confirmation avant d'envoyer un formulaire de suppression.
document.querySelectorAll("form[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!window.confirm(form.dataset.confirm)) {
      event.preventDefault();
    }
  });
});

// Filtre les lignes du tableau pendant la saisie dans le champ de recherche.
const search = document.getElementById("search");
const table = document.querySelector("table");
if (search && table) {
  search.addEventListener("input", () => {
    const filter = search.value.toUpperCase();
    table.querySelectorAll("tr").forEach((row) => {
      if (row.querySelector("td")) {
        row.style.display = row.textContent.toUpperCase().includes(filter) ? "" : "none";
      }
    });
  });
}
