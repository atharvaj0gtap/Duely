import { useState, useEffect, useRef } from 'react'
import { getInvoiceNumber, getPayPeriodRange } from './utils/invoiceUtils'
import { useConfig } from './config/useConfig'
import InvoiceModal from './components/InvoiceModal'

// Get today's date in YYYY-MM-DD format using local timezone
const getLocalDateString = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function App() {
  const { config } = useConfig()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    Task: '',
    Description: '',
    Date: getLocalDateString(),
    Hours: ''
  })
  const [editingIndex, setEditingIndex] = useState(null)
  const [editData, setEditData] = useState(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const editingRowRef = useRef(null)
  const editDataRef = useRef(null)
  const editingIndexRef = useRef(null)
  const configRef = useRef(config)

  useEffect(() => {
    fetchEntries()
  }, [])

  // Keep refs in sync with state
  useEffect(() => {
    editDataRef.current = editData
    editingIndexRef.current = editingIndex
    configRef.current = config
  }, [editData, editingIndex, config])

  // Click outside handler to save edits
  useEffect(() => {
    const handleClickOutside = async (event) => {
      if (editingRowRef.current && !editingRowRef.current.contains(event.target) && editingIndexRef.current !== null) {
        // Validate hours is not negative
        if (Number(editDataRef.current.Hours) < 0) {
          setError('Hours cannot be negative')
          setEditingIndex(null)
          setEditData(null)
          return
        }
        
        // Save the edit with recalculated invoice
        try {
          const invoiceNumber = getInvoiceNumber(editDataRef.current.Date, configRef.current)
          
          const response = await fetch(`http://localhost:3001/api/entries/${editingIndexRef.current}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...editDataRef.current,
              Hours: Number(editDataRef.current.Hours),
              Invoice: invoiceNumber
            }),
          })

          if (!response.ok) throw new Error('Failed to update entry')
          
          await fetchEntries()
          setEditingIndex(null)
          setEditData(null)
        } catch (err) {
          setError(err.message)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchEntries = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/entries')
      if (!response.ok) throw new Error('Failed to fetch entries')
      const data = await response.json()
      setEntries(data)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate hours is not negative
    if (Number(formData.Hours) < 0) {
      setError('Hours cannot be negative')
      return
    }
    
    try {
      // Auto-calculate invoice number based on date
      const invoiceNumber = getInvoiceNumber(formData.Date, config)

      const response = await fetch('http://localhost:3001/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          Hours: Number(formData.Hours),
          Invoice: invoiceNumber
        }),
      })

      if (!response.ok) throw new Error('Failed to save entry')
      
      // Refresh list
      await fetchEntries()
      
      // Reset form (keep Date as today)
      setFormData({
        Task: '',
        Description: '',
        Date: getLocalDateString(),
        Hours: ''
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (index) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return

    try {
      const response = await fetch(`http://localhost:3001/api/entries/${index}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete entry')
      
      await fetchEntries()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEdit = (index) => {
    setEditingIndex(index)
    setEditData({ ...entries[index] })
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      // Cancel and restore original values
      setEditingIndex(null)
      setEditData(null)
    }
  }

  const handleSaveEdit = async () => {
    // Validate hours is not negative
    if (Number(editData.Hours) < 0) {
      setError('Hours cannot be negative')
      return
    }
    
    try {
      // Recalculate invoice number based on the edited date
      const invoiceNumber = getInvoiceNumber(editData.Date, config)

      const response = await fetch(`http://localhost:3001/api/entries/${editingIndex}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...editData,
          Hours: Number(editData.Hours),
          Invoice: invoiceNumber
        }),
      })

      if (!response.ok) throw new Error('Failed to update entry')
      
      await fetchEntries()
      setEditingIndex(null)
      setEditData(null)
    } catch (err) {
      setError(err.message)
    }
  }

  // Calculate total hours
  const totalHours = entries.reduce((sum, entry) => sum + (Number(entry.Hours) || 0), 0)

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-9xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Duely</h1>
            <p className="text-gray-600">Track your contractor hours and generate invoices</p>
          </div>
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate Invoice
          </button>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h2 className="text-xl font-semibold mb-4">Add New Entry</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Task</label>
                  <input
                    type="text"
                    name="Task"
                    value={formData.Task}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                    placeholder="e.g. Frontend Dev"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="Description"
                    value={formData.Description}
                    onChange={handleChange}
                    rows="3"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                    placeholder="Details of work done..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    name="Date"
                    value={formData.Date}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Hours</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    name="Hours"
                    value={formData.Hours}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                    placeholder="0.0"
                  />
                </div>

                {formData.Date && (
                  <div className="bg-blue-50 rounded-md p-3 text-sm">
                    <div className="text-blue-800 font-medium">Pay Period</div>
                    <div className="text-blue-600">{getPayPeriodRange(formData.Date, config)}</div>
                    <div className="text-blue-500 text-xs mt-1">{getInvoiceNumber(formData.Date, config)}</div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                >
                  Add Entry
                </button>
              </form>
            </div>
          </div>

          {/* List Section */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow bg-white">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold">Work Log</h2>
                <div className="text-sm text-gray-500">
                  Total Hours: <span className="font-bold text-gray-900">{totalHours.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Description</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">Loading...</td>
                      </tr>
                    ) : entries.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No entries found. Start working!</td>
                      </tr>
                    ) : (
                      [...entries].map((entry, idx) => ({ entry, originalIndex: idx })).reverse().map(({ entry, originalIndex }) => (
                        <tr 
                          key={originalIndex}
                          ref={editingIndex === originalIndex ? editingRowRef : null}
                          className={editingIndex === originalIndex 
                            ? "bg-blue-50 ring-2 ring-blue-500 ring-inset" 
                            : "hover:bg-gray-50 group"
                          }
                        >
                          {editingIndex === originalIndex ? (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <input
                                  type="date"
                                  name="Date"
                                  value={editData.Date}
                                  onChange={handleEditChange}
                                  onKeyDown={handleKeyDown}
                                  className="w-full px-2 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                  autoFocus
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <input
                                  type="text"
                                  name="Task"
                                  value={editData.Task}
                                  onChange={handleEditChange}
                                  onKeyDown={handleKeyDown}
                                  className="w-full px-2 py-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                <input
                                  type="text"
                                  name="Description"
                                  value={editData.Description || ''}
                                  onChange={handleEditChange}
                                  onKeyDown={handleKeyDown}
                                  className="w-full px-2 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  name="Hours"
                                  value={editData.Hours}
                                  onChange={handleEditChange}
                                  onKeyDown={handleKeyDown}
                                  className="w-20 px-2 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <input
                                  type="text"
                                  name="Invoice"
                                  value={editData.Invoice || ''}
                                  onChange={handleEditChange}
                                  onKeyDown={handleKeyDown}
                                  placeholder="-"
                                  className="w-full px-2 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                <button
                                  onClick={() => handleDelete(originalIndex)}
                                  className="text-gray-400 hover:text-red-600 cursor-pointer transition-colors"
                                  title="Delete"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td onClick={() => handleEdit(originalIndex)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 cursor-pointer transition-colors">{entry.Date}</td>
                              <td onClick={() => handleEdit(originalIndex)} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer transition-colors">{entry.Task}</td>
                              <td onClick={() => handleEdit(originalIndex)} className="px-6 py-4 text-sm text-gray-500 whitespace-pre-wrap cursor-pointer transition-colors">{entry.Description}</td>
                              <td onClick={() => handleEdit(originalIndex)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 cursor-pointer transition-colors">{entry.Hours}</td>
                              <td onClick={() => handleEdit(originalIndex)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer transition-colors">{entry.Invoice || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                <button
                                  onClick={() => handleDelete(originalIndex)}
                                  className="text-gray-400 hover:text-red-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      <InvoiceModal 
        isOpen={isInvoiceModalOpen} 
        onClose={() => setIsInvoiceModalOpen(false)} 
        entries={entries}
      />
    </div>
  )
}

export default App
