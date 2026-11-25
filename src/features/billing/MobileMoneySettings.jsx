import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { Alert, Badge, Button, Card, ConfirmDialog, Field, FormGrid, Input, PageLoader, useToast } from '../../components/ui'
import { errorMessage } from '../../lib/errors.js'
import { hasErrors, validateMobileMoneyKeys } from '../../lib/validation.js'
import { useClearMobileSettings, useMobileSettings, useSaveMobileSettings } from '../sales/mobileApi.js'
import { LoadError } from '../shared/LoadError.jsx'
import shared from '../shared/shared.module.css'
import styles from './SubscriptionPage.module.css'

const EMPTY = { api_key: '', webhook_secret: '' }

/**
 * Réglage « Paiement mobile money » (administrateur) : la pharmacie enregistre
 * sa clé NabooPay pour encaisser les ventes sur son propre compte. Les clés ne
 * sont jamais relues : les champs restent vides, on ne peut que les remplacer.
 */
export function MobileMoneySettings() {
  const toast = useToast()
  const settings = useMobileSettings()
  const save = useSaveMobileSettings()
  const clear = useClearMobileSettings()
  const formRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [attempts, setAttempts] = useState(0)
  const [serverError, setServerError] = useState(null)
  const [confirmingClear, setConfirmingClear] = useState(false)

  useEffect(() => {
    if (attempts > 0) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [attempts])

  const bind = (name) => ({
    name,
    value: form[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  })

  const submit = async (event) => {
    event.preventDefault()
    if (save.isPending) return
    const result = validateMobileMoneyKeys(form)
    setErrors(result.errors)
    setServerError(null)
    if (hasErrors(result.errors)) {
      setAttempts((count) => count + 1)
      return
    }
    try {
      await save.mutateAsync({ apiKey: result.values.api_key, webhookSecret: result.values.webhook_secret })
      setForm(EMPTY)
      toast.success('Paiement mobile money activé.')
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  const disable = async () => {
    try {
      await clear.mutateAsync()
      setConfirmingClear(false)
      toast.success('Paiement mobile money désactivé.')
    } catch (error) {
      setConfirmingClear(false)
      toast.error(errorMessage(error))
    }
  }

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(settings.data.webhook_url)
      toast.success('Adresse du webhook copiée.')
    } catch {
      toast.error('Copie impossible : sélectionnez l’adresse et copiez-la à la main.')
    }
  }

  const configured = settings.data?.configured === true

  return (
    <Card
      title="Paiement mobile money"
      subtitle="Vos clients paient à la caisse avec Wave ou Orange Money, sur le compte NabooPay de la pharmacie."
      actions={settings.data ? <Badge tone={configured ? 'success' : 'neutral'}>{configured ? 'Activé' : 'Non configuré'}</Badge> : null}
    >
      {settings.isPending ? (
        <PageLoader fullScreen={false} label="Chargement du réglage…" />
      ) : settings.isError ? (
        <LoadError query={settings} />
      ) : (
        <form ref={formRef} onSubmit={submit} noValidate className={styles.form}>
          <ol className={styles.steps}>
            <li>
              Dans NabooPay, ouvrez <strong>Paramètres → Intégration</strong> et créez une clé d’API de portée « checkout ».
            </li>
            <li>Collez-la ci-dessous. Elle est vérifiée auprès de NabooPay, puis gardée chiffrée : elle n’est plus jamais affichée.</li>
            <li>L’argent arrive sur le compte NabooPay de la pharmacie ; les frais NabooPay sont à la charge de la pharmacie.</li>
          </ol>

          {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
          <FormGrid>
            <Field
              label={configured ? 'Nouvelle clé d’API NabooPay' : 'Clé d’API NabooPay'}
              htmlFor="mobile-cle-api"
              required
              error={errors.api_key}
              hint={configured ? 'Une clé est déjà enregistrée : saisissez-en une pour la remplacer.' : undefined}
            >
              <Input {...bind('api_key')} type="password" autoComplete="off" spellCheck={false} />
            </Field>
            <Field
              label="Clé secrète du webhook"
              htmlFor="mobile-cle-webhook"
              error={errors.webhook_secret}
              hint={
                settings.data.has_webhook_secret
                  ? 'Facultative. Une clé est déjà enregistrée : laissez vide pour la garder.'
                  : 'Facultative : elle accélère la confirmation des paiements.'
              }
            >
              <Input {...bind('webhook_secret')} type="password" autoComplete="off" spellCheck={false} />
            </Field>
          </FormGrid>

          <Field label="Adresse du webhook à déclarer dans NabooPay" htmlFor="mobile-webhook-url" hint="Facultatif : NabooPay y annonce les paiements reçus.">
            <Input readOnly value={settings.data.webhook_url} onFocus={(event) => event.target.select()} />
          </Field>

          <div className={shared.filters}>
            <Button type="submit" loading={save.isPending}>
              {configured ? 'Remplacer la clé' : 'Activer le paiement mobile'}
            </Button>
            <Button variant="secondary" icon={Copy} onClick={copyWebhook}>
              Copier l’adresse du webhook
            </Button>
            {configured ? (
              <Button variant="danger" onClick={() => setConfirmingClear(true)}>
                Désactiver
              </Button>
            ) : null}
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmingClear}
        title="Désactiver le paiement mobile money ?"
        message="La clé NabooPay de la pharmacie sera effacée : la caisse ne proposera plus que le paiement en espèces. Les paiements mobiles encore en attente ne pourront plus être vérifiés."
        confirmLabel="Désactiver"
        loading={clear.isPending}
        onConfirm={disable}
        onCancel={() => setConfirmingClear(false)}
      />
    </Card>
  )
}
