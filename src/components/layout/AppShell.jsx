import { useEffect, useId, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import { Logo } from './Logo.jsx'
import { useTheme } from './useTheme.js'
import styles from './AppShell.module.css'

const ROLE_LABELS = {
  admin: 'Administrateur',
  pharmacien: 'Pharmacien',
  caissier: 'Caissier',
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * Coque de l'application connectée : barre latérale (tiroir sous 900px),
 * en-tête mobile et zone de contenu.
 * Props :
 *  - user : { name, email, role } (role 'admin'|'pharmacien'|'caissier', ou libellé libre)
 *  - navItems : [{ to, label, icon (composant lucide), end? }]
 *  - onSignOut() : clic sur « Se déconnecter »
 *  - children : contenu de la page
 *  - brand? (nom affiché, défaut « PharmaCaisse »), brandHint? (ligne sous le nom, ex. le nom de l'officine)
 * La bascule clair/sombre est mémorisée dans localStorage.
 */
export function AppShell({ user, navItems = [], onSignOut, children, brand = 'PharmaCaisse', brandHint }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const sidebarId = useId()
  const closeRef = useRef(null)
  const menuButtonRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    const desktop = window.matchMedia('(min-width: 901px)')
    const onResize = (event) => {
      if (event.matches) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', onResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', onResize)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : null
  const ThemeIcon = theme === 'dark' ? Sun : Moon
  const themeLabel = theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'

  return (
    <div className={styles.shell} data-menu-open={menuOpen || undefined}>
      <a className={styles.skip} href="#contenu">
        Aller au contenu
      </a>

      <header className={styles.topbar}>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.topbarButton}
          onClick={() => setMenuOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={menuOpen}
          aria-controls={sidebarId}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <span className={styles.topbarBrand}>
          <Logo size={28} />
          <span>{brand}</span>
        </span>
        <button type="button" className={styles.topbarButton} onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
          <ThemeIcon size={20} aria-hidden="true" />
        </button>
      </header>

      <div className={styles.backdrop} onClick={closeMenu} aria-hidden="true" />

      <aside className={styles.sidebar} id={sidebarId} aria-label="Menu principal">
        <div className={styles.brand}>
          <Logo size={36} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>{brand}</span>
            {brandHint ? <span className={styles.brandHint}>{brandHint}</span> : null}
          </div>
          <button ref={closeRef} type="button" className={styles.closeButton} onClick={closeMenu} aria-label="Fermer le menu">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className={styles.nav} aria-label="Navigation">
          <ul className={styles.navList}>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={closeMenu}
                    className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink)}
                  >
                    {Icon ? <Icon size={19} strokeWidth={1.9} aria-hidden="true" className={styles.navIcon} /> : null}
                    <span className={styles.navLabel}>{item.label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={styles.account}>
          <div className={styles.user}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(user?.name || user?.email)}
            </span>
            <div className={styles.userText}>
              <span className={styles.userName}>{user?.name || user?.email || 'Utilisateur'}</span>
              {roleLabel ? <span className={styles.userRole}>{roleLabel}</span> : null}
              {user?.email && user?.name ? (
                <span className={styles.userEmail} title={user.email}>
                  {user.email}
                </span>
              ) : null}
            </div>
          </div>
          <div className={styles.accountActions}>
            <button type="button" className={styles.signOut} onClick={onSignOut}>
              <LogOut size={17} aria-hidden="true" />
              <span>Se déconnecter</span>
            </button>
            <button type="button" className={styles.themeButton} onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
              <ThemeIcon size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main} id="contenu" tabIndex={-1}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  )
}
