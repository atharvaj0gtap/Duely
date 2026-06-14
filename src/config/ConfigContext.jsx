import { useEffect, useState } from 'react'
import { API_BASE, ConfigContext } from './useConfig'

// Provider that loads the runtime config from the server once at startup and
// makes it available to the whole app. Until it loads we show a small splash so
// no component renders with a missing config. saveConfig is exposed for a future
// in-app settings screen (PUT /api/config).
export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load config')
        return res.json()
      })
      .then(setConfig)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const saveConfig = async (next) => {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    if (!res.ok) throw new Error('Failed to save config')
    const saved = await res.json()
    setConfig(saved)
    return saved
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 px-8 text-center">
        {error}. Make sure the server is running (npm run dev:full).
      </div>
    )
  }

  return (
    <ConfigContext.Provider value={{ config, saveConfig }}>
      {children}
    </ConfigContext.Provider>
  )
}
