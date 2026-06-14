// Helpers that derive display strings from a runtime config object.
// Config is loaded from the server at startup (see ConfigContext) rather than
// hardcoded, so these take the config as an explicit argument.

// Format a currency amount, e.g. "30.00 CAD"
export const formatCurrency = (amount, config) => {
  return `${amount.toFixed(2)} ${config.payment.currency}`
}

// Build the client's full address, e.g. "281 Industrial Ave, Vancouver, BC V6A 2P3"
export const getClientFullAddress = (config) => {
  const { address, city, province, postalCode } = config.client
  return `${address}, ${city}, ${province} ${postalCode}`
}
