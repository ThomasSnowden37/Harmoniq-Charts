import React from 'react'
import ReactDOM from 'react-dom/client'
import '@radix-ui/themes/styles.css'
import { Theme } from '@radix-ui/themes'
import App from './App'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from 'next-themes'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <ThemeProvider attribute="class">
        <Theme accentColor="blue" radius="medium">
          <AuthProvider>
            <App />
          </AuthProvider>
        </Theme>
      </ThemeProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
