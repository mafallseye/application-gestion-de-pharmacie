import { Badge } from '../../components/ui'
import { formatMoney } from '../../lib/format.js'
import { paymentStatus, saleBalance } from './filters.js'

/** État de paiement d'une vente : « Payée », « Reste … », « Impayée » ou « Paiement mobile en attente ». */
export function PaymentBadge({ sale }) {
  if (sale.awaiting_mobile) return <Badge tone="info">Paiement mobile en attente</Badge>
  const status = paymentStatus(sale)
  if (status === 'paid') return <Badge tone="success">Payée</Badge>
  if (status === 'partial') return <Badge tone="warning">Reste {formatMoney(saleBalance(sale))}</Badge>
  return <Badge tone="danger">Impayée</Badge>
}
