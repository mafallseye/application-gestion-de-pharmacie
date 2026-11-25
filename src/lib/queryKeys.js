// Clés React Query, regroupées ici pour que les invalidations restent cohérentes.
export const queryKeys = {
  profile: (userId) => ['profile', userId],
  profiles: ['profiles'],
  categories: ['categories'],
  suppliers: ['suppliers'],
  customers: ['customers'],
  medicines: ['medicines'],
  sales: ['sales'],
  salesList: (filters = {}) => ['sales', 'list', filters],
  sale: (id) => ['sales', 'detail', Number(id)],
  dashboard: ['dashboard'],
  plans: ['plans'],
  mobileSettings: ['mobile-settings'],
  subscriptionPayments: ['subscription-payments'],
  paymentCheck: (token) => ['payment-check', token],
}

// Invalide plusieurs familles de requêtes après une mutation.
export function invalidate(queryClient, ...keys) {
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
