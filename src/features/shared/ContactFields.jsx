import { Field, FormGrid, FullRow, Input, Textarea } from '../../components/ui'

/** Champs communs aux clients et aux fournisseurs. `prefix` rend les id uniques. */
export function ContactFields({ prefix, errors, bind, namePlaceholder }) {
  return (
    <FormGrid>
      <FullRow>
        <Field label="Nom" htmlFor={`${prefix}-nom`} required error={errors.name}>
          <Input {...bind('name')} placeholder={namePlaceholder} maxLength={160} />
        </Field>
      </FullRow>
      <Field label="Téléphone" htmlFor={`${prefix}-telephone`} error={errors.phone}>
        <Input {...bind('phone')} type="tel" autoComplete="off" placeholder="ex. 77 123 45 67" maxLength={40} />
      </Field>
      <Field label="Fax" htmlFor={`${prefix}-fax`} error={errors.fax}>
        <Input {...bind('fax')} type="tel" autoComplete="off" maxLength={40} />
      </Field>
      <FullRow>
        <Field label="Adresse" htmlFor={`${prefix}-adresse`} error={errors.address}>
          <Input {...bind('address')} placeholder="ex. Rue 10, Médina, Dakar" maxLength={255} />
        </Field>
      </FullRow>
      <FullRow>
        <Field label="Remarques" htmlFor={`${prefix}-remarques`} error={errors.info}>
          <Textarea {...bind('info')} maxLength={1000} />
        </Field>
      </FullRow>
    </FormGrid>
  )
}
