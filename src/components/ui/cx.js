/** Assemble des noms de classes en ignorant les valeurs vides. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}
