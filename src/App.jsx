import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import { DesignPreview, LoginPreview, PendingPreview } from './pages/DesignPreview.jsx'

// Routage provisoire (aperçu du design system). Les routes /apercu sont à conserver.
function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/apercu/connexion" element={<LoginPreview />} />
          <Route path="/apercu/attente" element={<PendingPreview />} />
          <Route path="/apercu/*" element={<DesignPreview />} />
          <Route path="*" element={<Navigate to="/apercu" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
