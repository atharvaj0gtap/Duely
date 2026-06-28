import { useState } from 'react'
import { useConfig } from '../config/useConfig'

// A single labelled input. Defined at module scope so it isn't re-created on
// every render (which would remount the input and drop focus while typing).
function Field({ label, value, onChange, type = 'text', placeholder, hint, error, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm rounded-md shadow-sm border outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }`}
        {...rest}
      />
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

// Mirror the server-side rules (server/index.js validateConfig) so users get
// friendly inline errors before hitting a 400. Stricter than the server in a
// couple of spots (required name, Sunday anchor) — that's fine.
const validate = (f) => {
  const e = {}
  if (!f.contractor.name?.trim()) e.name = 'Your name is required'
  if (f.contractor.email && !isEmail(f.contractor.email)) e.email = 'Enter a valid email address'
  if (f.contractor.paymentEmail && !isEmail(f.contractor.paymentEmail)) e.paymentEmail = 'Enter a valid email address'
  if (!f.client.name?.trim()) e.clientName = 'Client name is required'

  const rate = Number(f.payment.hourlyRate)
  if (!Number.isFinite(rate) || rate < 0) e.hourlyRate = 'Rate must be a number of 0 or more'
  if (!f.payment.currency?.trim()) e.currency = 'Currency is required'

  const len = Number(f.payPeriod.periodLengthDays)
  if (!Number.isInteger(len) || len < 1) e.periodLengthDays = 'Must be a whole number (e.g. 14)'
  const offset = Number(f.payPeriod.paymentDaysAfterPeriodEnd)
  if (!Number.isInteger(offset) || offset < 0) e.paymentDaysAfterPeriodEnd = 'Must be a whole number of 0 or more'

  const d = f.payPeriod.referenceStartDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) {
    e.referenceStartDate = 'Pick a start date'
  } else {
    const [y, m, day] = d.split('-').map(Number)
    if (new Date(y, m - 1, day).getDay() !== 0) e.referenceStartDate = 'Must be a Sunday (pay periods start on Sunday)'
  }
  return e
}

const SettingsModal = ({ onClose, firstRun = false }) => {
  const { config, saveConfig } = useConfig()
  const [form, setForm] = useState(() => structuredClone(config))
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  // Curried updater: setField('contractor', 'name') -> (value) => ...
  const setField = (section, key) => (value) =>
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }))

  const handleSave = async () => {
    const found = validate(form)
    setErrors(found)
    setServerError('')
    if (Object.keys(found).length > 0) return

    const payload = {
      contractor: {
        name: form.contractor.name.trim(),
        email: form.contractor.email.trim(),
        paymentEmail: form.contractor.paymentEmail.trim(),
      },
      client: {
        name: form.client.name.trim(),
        address: form.client.address.trim(),
        city: form.client.city.trim(),
        province: form.client.province.trim(),
        postalCode: form.client.postalCode.trim(),
        country: form.client.country.trim(),
      },
      payment: {
        hourlyRate: Number(form.payment.hourlyRate),
        currency: form.payment.currency.trim(),
        currencySymbol: form.payment.currencySymbol.trim(),
      },
      payPeriod: {
        referenceStartDate: form.payPeriod.referenceStartDate,
        periodLengthDays: Number(form.payPeriod.periodLengthDays),
        paymentDaysAfterPeriodEnd: Number(form.payPeriod.paymentDaysAfterPeriodEnd),
      },
    }

    setSaving(true)
    try {
      await saveConfig(payload)
      onClose()
    } catch (err) {
      setServerError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[100vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {firstRun ? 'Welcome to Duely — set up your details' : 'Settings'}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {firstRun && (
              <p className="mt-1 text-sm text-gray-500">
                These details appear on your invoices and stay on your machine. You can change them anytime from Settings.
              </p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-150px)] space-y-6">
            {serverError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm">
                {serverError}
              </div>
            )}

            {/* Your details */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Your details</h3>
              <div className="space-y-4">
                <Field label="Name" value={form.contractor.name} onChange={setField('contractor', 'name')}
                  placeholder="Jane Contractor" maxLength={200} error={errors.name} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Email" type="email" value={form.contractor.email} onChange={setField('contractor', 'email')}
                    placeholder="you@example.com" maxLength={254} error={errors.email} />
                  <Field label="Payment email" type="email" value={form.contractor.paymentEmail} onChange={setField('contractor', 'paymentEmail')}
                    placeholder="you@example.com" hint="Where e-transfers are sent" maxLength={254} error={errors.paymentEmail} />
                </div>
              </div>
            </section>

            {/* Client */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Client</h3>
              <div className="space-y-4">
                <Field label="Company name" value={form.client.name} onChange={setField('client', 'name')}
                  placeholder="Client Company Inc." maxLength={200} error={errors.clientName} />
                <Field label="Address" value={form.client.address} onChange={setField('client', 'address')}
                  placeholder="123 Main Street" maxLength={200} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="City" value={form.client.city} onChange={setField('client', 'city')} maxLength={200} />
                  <Field label="Province / State" value={form.client.province} onChange={setField('client', 'province')} maxLength={200} />
                  <Field label="Postal / ZIP code" value={form.client.postalCode} onChange={setField('client', 'postalCode')} maxLength={200} />
                  <Field label="Country" value={form.client.country} onChange={setField('client', 'country')} maxLength={200} />
                </div>
              </div>
            </section>

            {/* Payment */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Payment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Hourly rate" type="number" min="0" step="0.01" value={form.payment.hourlyRate}
                  onChange={setField('payment', 'hourlyRate')} error={errors.hourlyRate} />
                <Field label="Currency" value={form.payment.currency} onChange={setField('payment', 'currency')}
                  placeholder="CAD" maxLength={10} error={errors.currency} />
                <Field label="Currency symbol" value={form.payment.currencySymbol} onChange={setField('payment', 'currencySymbol')}
                  placeholder="$" maxLength={5} />
              </div>
            </section>

            {/* Pay period */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Pay period</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Reference start date" type="date" value={form.payPeriod.referenceStartDate}
                  onChange={setField('payPeriod', 'referenceStartDate')} hint="Any Sunday that anchors your schedule"
                  error={errors.referenceStartDate} />
                <Field label="Period length (days)" type="number" min="1" step="1" value={form.payPeriod.periodLengthDays}
                  onChange={setField('payPeriod', 'periodLengthDays')} hint="14 = bi-weekly" error={errors.periodLengthDays} />
                <Field label="Payment due" type="number" min="0" step="1" value={form.payPeriod.paymentDaysAfterPeriodEnd}
                  onChange={setField('payPeriod', 'paymentDaysAfterPeriodEnd')} hint="Days after the period ends" error={errors.paymentDaysAfterPeriodEnd} />
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {firstRun ? 'Skip for now' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
