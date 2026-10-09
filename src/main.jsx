import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import CryptoSessionProvider from './contexts/CryptoSessionProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CryptoSessionProvider>
          <App />
        </CryptoSessionProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
