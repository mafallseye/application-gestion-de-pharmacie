import { useEffect, useId, useRef, useState } from 'react'
import { Alert, Button, Modal, Stack, useToast } from '../../components/ui'
import { errorMessage } from '../../lib/errors.js'
import { hasErrors } from '../../lib/validation.js'

/**
 * Formulaire dans une modale : validation, envoi, erreurs serveur, toast de succès.
 * Props :
 *  - open, onClose, title, description?, size?, submitLabel, successMessage
 *  - initialValues : valeurs de départ (relues à chaque ouverture)
 *  - validate(values) → { values, errors } (voir lib/validation.js)
 *  - onSubmit(valeursValidées) : promesse ; son rejet s'affiche dans la modale
 *  - children({ values, errors, bind }) : les champs ; `bind('nom')` donne
 *    { name, value, onChange } à poser sur Input / Select / Textarea.
 */
export function FormModal({
  open,
  onClose,
  title,
  description,
  size,
  submitLabel,
  successMessage,
  initialValues,
  validate,
  onSubmit,
  children,
}) {
  const formId = useId()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)

  const close = () => {
    setServerError(null)
    onClose()
  }

  const submit = async (values) => {
    if (saving) return
    setSaving(true)
    setServerError(null)
    try {
      await onSubmit(values)
      // La modale se ferme avant le toast : il passerait sinon dessous.
      onClose()
      toast.success(successMessage)
    } catch (error) {
      setServerError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      size={size}
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <FormBody id={formId} initialValues={initialValues} validate={validate} onValid={submit} serverError={serverError}>
        {children}
      </FormBody>
    </Modal>
  )
}

// Monté seulement quand la modale est ouverte : l'état repart de zéro à chaque ouverture.
function FormBody({ id, initialValues, validate, onValid, serverError, children }) {
  const formRef = useRef(null)
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [attempts, setAttempts] = useState(0)

  // Après un envoi refusé, le focus va au premier champ en erreur.
  useEffect(() => {
    if (attempts > 0) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [attempts])

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (event) => setValues((current) => ({ ...current, [name]: event.target.value })),
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    const result = validate(values)
    setErrors(result.errors)
    if (hasErrors(result.errors)) setAttempts((count) => count + 1)
    else onValid(result.values)
  }

  return (
    <form id={id} ref={formRef} onSubmit={handleSubmit} noValidate>
      <Stack gap="var(--space-4)">
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        {children({ values, errors, bind })}
      </Stack>
    </form>
  )
}
