import { Suspense, lazy } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { LayoutDashboard, Pill, Receipt, ShoppingCart, Tags, Truck, UserCog, Users } from 'lucide-react'
import { AppShell } from './components/layout/AppShell.jsx'
import { PageLoader, ToastProvider, useToast } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import { errorMessage } from './lib/errors.js'
import { createQueryClient } from './lib/queryClient.js'
import { isSupabaseConfigured } from './lib/supabase.js'

const queryClient = createQueryClient()

// Pages chargées à la demande : la connexion ne télécharge pas toute l'application.
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'))
const AccountStatusPage = lazy(() => import('./pages/AccountStatusPage.jsx'))
const SetupPage = lazy(() => import('./pages/SetupPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'))
const NewSalePage = lazy(() => import('./features/sales/NewSalePage.jsx'))
const SalesPage = lazy(() => import('./features/sales/SalesPage.jsx'))
const SaleDetailPage = lazy(() => import('./features/sales/SaleDetailPage.jsx'))
const MedicinesPage = lazy(() => import('./features/medicines/MedicinesPage.jsx'))
const CategoriesPage = lazy(() => import('./features/categories/CategoriesPage.jsx'))
const CustomersPage = lazy(() => import('./features/customers/CustomersPage.jsx'))
const SuppliersPage = lazy(() => import('./features/suppliers/SuppliersPage.jsx'))
const UsersPage = lazy(() => import('./features/users/UsersPage.jsx'))
// Aperçu du design system (données fictives, accessible sans connexion).
const preview = (name) => lazy(() => import('./pages/DesignPreview.jsx').then((module) => ({ default: module[name] })))
const DesignPreview = preview('DesignPreview')
const LoginPreview = preview('LoginPreview')
const PendingPreview = preview('PendingPreview')

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/caisse', label: 'Nouvelle vente', icon: ShoppingCart },
  { to: '/ventes', label: 'Ventes', icon: Receipt },
  { to: '/medicaments', label: 'Médicaments', icon: Pill },
  { to: '/categories', label: 'Catégories', icon: Tags },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: Truck },
  { to: '/utilisateurs', label: 'Utilisateurs', icon: UserCog, adminOnly: true },
]

const previewRoutes = (
  <>
    <Route path="/apercu/connexion" element={<LoginPreview />} />
    <Route path="/apercu/attente" element={<PendingPreview />} />
    <Route path="/apercu/*" element={<DesignPreview />} />
  </>
)

/** Garde des pages connectées : session, profil actif, puis coque de l'application. */
function ProtectedLayout() {
  const { loading, user, profile, profileError, isStaff, isAdmin, signOut } = useAuth()
  const location = useLocation()
  const toast = useToast()

  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />
  if (!profile && profileError) return <AccountStatusPage error={profileError} />
  if (!isStaff) return <AccountStatusPage />

  return (
    <AppShell
      user={{ name: profile.full_name, email: profile.email, role: profile.role }}
      navItems={NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly)}
      onSignOut={() => signOut().catch((error) => toast.error(errorMessage(error)))}
    >
      <Suspense fallback={<PageLoader fullScreen={false} />}>
        <Outlet />
      </Suspense>
    </AppShell>
  )
}

/** Pages réservées aux administrateurs : les autres sont renvoyés à l'accueil, sans rien afficher. */
function AdminOnly() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}

function AppRoutes() {
  return (
    <Routes>
      {previewRoutes}
      <Route path="/connexion" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="caisse" element={<NewSalePage />} />
        <Route path="ventes" element={<SalesPage />} />
        <Route path="ventes/:id" element={<SaleDetailPage />} />
        <Route path="medicaments" element={<MedicinesPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="clients" element={<CustomersPage />} />
        <Route path="fournisseurs" element={<SuppliersPage />} />
        <Route element={<AdminOnly />}>
          <Route path="utilisateurs" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

// Sans configuration Supabase, seule la page d'explication (et l'aperçu) existe.
function SetupRoutes() {
  return (
    <Routes>
      {previewRoutes}
      <Route path="*" element={<SetupPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            {isSupabaseConfigured ? (
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            ) : (
              <SetupRoutes />
            )}
          </Suspense>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
