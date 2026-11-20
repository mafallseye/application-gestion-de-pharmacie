// Applique le thème mémorisé avant le premier rendu (évite le flash).
// Fichier séparé : la politique de sécurité (CSP) interdit les scripts en ligne.
try {
  var t = localStorage.getItem('pharmacie-theme')
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
} catch (e) {}
