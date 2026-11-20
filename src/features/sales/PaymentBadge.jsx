import { Badge } from '../../components/ui'
import { formatMoney } from '../../lib/format.js'
import { paymentStatus, saleBalance } from './filters.js'

/** État de paiement d'une vente : « Payée », « Reste … » ou « Impayée ». */
export function PaymentBadge({ sale }) {
  const status = paymentStatus(sale)
  if (status === 'paid') return <Badge tone="success">Payée</Badge>
  if (status === 'partial') return <Badge tone="warning">Reste {formatMoney(saleBalance(sale))}</Badge>
  return <Badge tone="danger">Impayée</Badge>
}
