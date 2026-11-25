import { Star } from 'lucide-react'
import { Field, Textarea } from '../../components/ui'
import { validateFeedback } from '../../lib/validation.js'
import { FormModal } from '../shared/FormModal.jsx'
import { useSendFeedback } from './api.js'
import styles from './FeedbackModal.module.css'

const RATINGS = [
  { value: '1', label: '1 étoile sur 5 : très insatisfait' },
  { value: '2', label: '2 étoiles sur 5 : insatisfait' },
  { value: '3', label: '3 étoiles sur 5 : correct' },
  { value: '4', label: '4 étoiles sur 5 : satisfait' },
  { value: '5', label: '5 étoiles sur 5 : très satisfait' },
]
const EMPTY = { rating: '', message: '', missing: '' }

/** « Donner mon avis » : note sur 5 (obligatoire) et deux remarques facultatives. */
export function FeedbackModal({ open, onClose }) {
  const send = useSendFeedback()
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Donner mon avis"
      description="Votre retour nous aide à améliorer l’application. Il est transmis à l’équipe qui la développe."
      submitLabel="Envoyer mon avis"
      successMessage="Merci pour votre avis !"
      initialValues={EMPTY}
      validate={validateFeedback}
      onSubmit={(values) => send.mutateAsync(values)}
    >
      {({ values, errors, bind }) => {
        // L'erreur de note disparaît dès qu'une note est choisie (sans attendre un nouvel envoi).
        const ratingError = values.rating === '' ? errors.rating : null
        return (
        <>
          {/* Vrai groupe de boutons radio : flèches du clavier pour changer la note. */}
          <fieldset className={styles.rating} aria-describedby={ratingError ? 'avis-note-erreur' : undefined}>
            <legend className={styles.legend}>
              Votre note <span aria-hidden="true">*</span>
            </legend>
            <div className={styles.stars}>
              {RATINGS.map((rating, index) => (
                <label key={rating.value} className={styles.star} data-on={values.rating !== '' && rating.value <= values.rating ? '' : undefined}>
                  <input
                    type="radio"
                    className="sr-only"
                    value={rating.value}
                    checked={values.rating === rating.value}
                    name="rating"
                    onChange={bind('rating').onChange}
                    aria-label={rating.label}
                    aria-invalid={ratingError && index === 0 ? true : undefined}
                    required
                    data-autofocus={index === 0 ? '' : undefined}
                  />
                  <Star size={30} strokeWidth={1.75} aria-hidden="true" />
                </label>
              ))}
            </div>
            {ratingError ? (
              <p className={styles.error} id="avis-note-erreur">
                {ratingError}
              </p>
            ) : null}
          </fieldset>
          <Field label="Votre avis" htmlFor="avis-message" error={errors.message} hint="Facultatif. Ce qui vous plaît, ce qui vous gêne…">
            <Textarea {...bind('message')} rows={3} maxLength={2000} />
          </Field>
          <Field label="Qu’est-ce qui vous manque ?" htmlFor="avis-manque" error={errors.missing} hint="Facultatif. Une fonction, un écran, une information…">
            <Textarea {...bind('missing')} rows={3} maxLength={2000} />
          </Field>
        </>
        )
      }}
    </FormModal>
  )
}
