// Invoice / pay-period calculations.
// These take the runtime `config` (loaded from the server) as an argument so no
// personal or business settings are hardcoded here.

// Calculate invoice number based on pay period
// Pay periods are 2-week blocks (Sunday to Saturday)
// Payment is on Friday of the week with the 2nd Monday after the period ends
export const getInvoiceNumber = (dateString, config) => {
  const paymentDate = getPaymentDate(dateString, config)

  const year = paymentDate.getFullYear()
  const month = String(paymentDate.getMonth() + 1).padStart(2, '0')
  const day = String(paymentDate.getDate()).padStart(2, '0')

  return `INV-${year}-${month}-${day}`
}

// Get the payment date for a given work date
export const getPaymentDate = (dateString, config) => {
  const { periodEnd } = getPayPeriodDates(dateString, config)

  // Payment date is periodEnd + paymentDaysAfterPeriodEnd
  const paymentDate = new Date(periodEnd)
  paymentDate.setDate(paymentDate.getDate() + config.payPeriod.paymentDaysAfterPeriodEnd)

  return paymentDate
}

// Parse date string as local date (avoids timezone issues)
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Get the start and end dates of the pay period for a given date
export const getPayPeriodDates = (dateString, config) => {
  const date = parseLocalDate(dateString)
  const referenceStart = parseLocalDate(config.payPeriod.referenceStartDate)

  const diffTime = date.getTime() - referenceStart.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  const periodOffset = Math.floor(diffDays / config.payPeriod.periodLengthDays)

  const periodStart = new Date(referenceStart)
  periodStart.setDate(periodStart.getDate() + (periodOffset * config.payPeriod.periodLengthDays))

  const periodEnd = new Date(periodStart)
  periodEnd.setDate(periodEnd.getDate() + config.payPeriod.periodLengthDays - 1)

  return { periodStart, periodEnd }
}

// Get pay period date range for display (e.g., "Nov 9 - Nov 22")
export const getPayPeriodRange = (dateString, config) => {
  const { periodStart, periodEnd } = getPayPeriodDates(dateString, config)

  const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return `${formatDate(periodStart)} - ${formatDate(periodEnd)}`
}

// Format date for table display (e.g., "Nov 26")
export const formatTableDate = (dateString) => {
  const date = parseLocalDate(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Get all unique pay periods from entries
export const getUniquePayPeriods = (entries, config) => {
  const periodsMap = new Map()

  entries.forEach(entry => {
    if (entry.Date && entry.Invoice) {
      const invoiceNumber = entry.Invoice
      if (!periodsMap.has(invoiceNumber)) {
        const { periodStart, periodEnd } = getPayPeriodDates(entry.Date, config)
        const paymentDate = getPaymentDate(entry.Date, config)
        periodsMap.set(invoiceNumber, {
          invoiceNumber,
          periodStart,
          periodEnd,
          paymentDate,
          label: getPayPeriodRange(entry.Date, config),
        })
      }
    }
  })

  // Sort by payment date descending (most recent first)
  return Array.from(periodsMap.values()).sort((a, b) => b.paymentDate - a.paymentDate)
}

// Get entries for a specific invoice number
export const getEntriesForInvoice = (entries, invoiceNumber) => {
  return entries.filter(entry => entry.Invoice === invoiceNumber)
}

// Calculate total hours for entries
export const calculateTotalHours = (entries) => {
  return entries.reduce((sum, entry) => sum + (Number(entry.Hours) || 0), 0)
}

// Calculate total amount for entries
export const calculateTotalAmount = (entries, config) => {
  const totalHours = calculateTotalHours(entries)
  return totalHours * config.payment.hourlyRate
}

// Format date for display (e.g., "Nov 9, 2025")
export const formatDisplayDate = (date) => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Format date for invoice (e.g., "November 9, 2025")
export const formatInvoiceDate = (date) => {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
