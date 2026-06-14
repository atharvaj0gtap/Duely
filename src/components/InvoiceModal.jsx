import { useState, useMemo } from 'react'
import { formatCurrency } from '../config/configHelpers'
import { useConfig } from '../config/useConfig'
import {
  getUniquePayPeriods,
  getEntriesForInvoice,
  calculateTotalHours,
  calculateTotalAmount,
  formatInvoiceDate
} from '../utils/invoiceUtils'
import { generateInvoicePDF } from '../utils/pdfGenerator'

const InvoiceModal = ({ isOpen, onClose, entries }) => {
  const { config } = useConfig()
  const [selectedInvoice, setSelectedInvoice] = useState('')

  // All derived from props/state, so no effects are needed.
  const payPeriods = useMemo(
    () => (entries.length > 0 ? getUniquePayPeriods(entries, config) : []),
    [entries, config]
  )

  // Default to the most recent period until the user picks one (or if their
  // previous pick is no longer present after entries change).
  const effectiveInvoice =
    selectedInvoice && payPeriods.some(p => p.invoiceNumber === selectedInvoice)
      ? selectedInvoice
      : (payPeriods[0]?.invoiceNumber ?? '')

  const invoiceEntries = useMemo(
    () => getEntriesForInvoice(entries, effectiveInvoice),
    [entries, effectiveInvoice]
  )
  const totalHours = useMemo(() => calculateTotalHours(invoiceEntries), [invoiceEntries])
  const totalAmount = useMemo(
    () => calculateTotalAmount(invoiceEntries, config),
    [invoiceEntries, config]
  )
  const selectedPeriod = useMemo(
    () => payPeriods.find(p => p.invoiceNumber === effectiveInvoice) ?? null,
    [payPeriods, effectiveInvoice]
  )

  const handleDownloadPDF = () => {
    if (selectedPeriod && invoiceEntries.length > 0) {
      generateInvoicePDF({
        invoiceNumber: effectiveInvoice,
        periodStart: selectedPeriod.periodStart,
        periodEnd: selectedPeriod.periodEnd,
        paymentDate: selectedPeriod.paymentDate,
        entries: invoiceEntries,
        totalHours,
        totalAmount,
      }, config)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Generate Invoice</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Period Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Pay Period</label>
              <select
                value={effectiveInvoice}
                onChange={(e) => setSelectedInvoice(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {payPeriods.length === 0 ? (
                  <option value="">No pay periods with entries</option>
                ) : (
                  payPeriods.map((period) => (
                    <option key={period.invoiceNumber} value={period.invoiceNumber}>
                      {period.label} ({period.invoiceNumber})
                    </option>
                  ))
                )}
              </select>
            </div>

            {payPeriods.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No entries found. Add some time entries first.</p>
              </div>
            ) : (
              <>
                {/* Invoice Preview */}
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  {/* Invoice Header */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">From</p>
                      <p className="font-semibold text-gray-900">{config.contractor.name}</p>
                      <p className="text-sm text-gray-500">{config.contractor.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">INVOICE</p>
                      <p className="text-sm text-gray-500">{effectiveInvoice}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">To</p>
                      <p className="font-semibold text-gray-900">{config.client.name}</p>
                      <p className="text-sm text-gray-500">
                        {config.client.address}, {config.client.city}, {config.client.province} {config.client.postalCode}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div className="mb-1">
                        <span className="text-gray-500">Issue Date: </span>
                        <span className="text-gray-900">{formatInvoiceDate(new Date())}</span>
                      </div>
                      <div className="mb-1">
                        <span className="text-gray-500">Due Date: </span>
                        <span className="text-gray-900">{selectedPeriod ? formatInvoiceDate(selectedPeriod.paymentDate) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Pay Period: </span>
                        <span className="text-gray-900">
                          {selectedPeriod 
                            ? `${formatInvoiceDate(selectedPeriod.periodStart)} - ${formatInvoiceDate(selectedPeriod.periodEnd)}`
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="border-t border-gray-300 pt-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 uppercase text-xs">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Task</th>
                          <th className="pb-2">Description</th>
                          <th className="pb-2 text-center">Hours</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-900">
                        {invoiceEntries.map((entry, index) => (
                          <tr key={index} className="border-t border-gray-200">
                            <td className="py-2">{entry.Date}</td>
                            <td className="py-2">{entry.Task}</td>
                            <td className="py-2 text-gray-500">{entry.Description || '-'}</td>
                            <td className="py-2 text-center">{entry.Hours}</td>
                            <td className="py-2 text-right">{formatCurrency(Number(entry.Hours) * config.payment.hourlyRate, config)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="border-t border-gray-300 mt-4 pt-4">
                    <div className="flex justify-end">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Total Hours:</span>
                          <span className="text-gray-900">{totalHours.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Rate:</span>
                          <span className="text-gray-900">{formatCurrency(config.payment.hourlyRate, config)}/hr</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                          <span className="text-gray-900">Total Due:</span>
                          <span className="text-blue-600">{formatCurrency(totalAmount, config)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="mt-6 pt-4 border-t border-gray-300">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Payment Instructions</p>
                    <p className="text-sm text-gray-700">Payment to be E-transferred to {config.contractor.paymentEmail}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={payPeriods.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvoiceModal
