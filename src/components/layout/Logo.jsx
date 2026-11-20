/**
 * Emblème de l'application : croix d'officine formée de deux gélules, point ambre.
 * Props : size? (px, défaut 36), className?.
 */
export function Logo({ size = 36, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#0e6b58" />
      <rect x="12.5" y="6" width="7" height="20" rx="3.5" fill="#fff" />
      <rect x="6" y="12.5" width="20" height="7" rx="3.5" fill="#fff" />
      <circle cx="16" cy="16" r="2.2" fill="#f0b14a" />
    </svg>
  )
}
