import { createContext, useContext } from 'react'

// Base URL for the local API server.
export const API_BASE = 'http://localhost:3001'

// Context that holds the runtime config loaded from the server by ConfigProvider.
export const ConfigContext = createContext(null)

// Access the runtime config (and saveConfig) from anywhere in the app.
export const useConfig = () => {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within a ConfigProvider')
  return ctx
}
