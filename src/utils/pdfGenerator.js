import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, getClientFullAddress } from '../config/configHelpers'
import { formatInvoiceDate, formatTableDate } from './invoiceUtils'

export const generateInvoicePDF = (invoiceData, config) => {
  const { invoiceNumber, periodStart, periodEnd, paymentDate, entries, totalHours, totalAmount } = invoiceData
  
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Colors
  const primaryColor = [37, 99, 235] // Blue
  const textColor = [31, 41, 55] // Dark gray
  const lightGray = [107, 114, 128]
  
  let yPos = 20
  
  // Header - INVOICE title
  doc.setFontSize(28)
  doc.setTextColor(...primaryColor)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', pageWidth - 20, yPos, { align: 'right' })
  
  // Invoice number
  yPos += 10
  doc.setFontSize(11)
  doc.setTextColor(...lightGray)
  doc.setFont('helvetica', 'normal')
  doc.text(invoiceNumber, pageWidth - 20, yPos, { align: 'right' })
  
  // From section
  yPos = 20
  doc.setFontSize(10)
  doc.setTextColor(...lightGray)
  doc.text('FROM', 20, yPos)
  
  yPos += 7
  doc.setFontSize(12)
  doc.setTextColor(...textColor)
  doc.setFont('helvetica', 'bold')
  doc.text(config.contractor.name, 20, yPos)

  yPos += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...lightGray)
  doc.text(config.contractor.email, 20, yPos)
  
  // To section
  yPos += 15
  doc.setFontSize(10)
  doc.setTextColor(...lightGray)
  doc.text('TO', 20, yPos)
  
  yPos += 7
  doc.setFontSize(12)
  doc.setTextColor(...textColor)
  doc.setFont('helvetica', 'bold')
  doc.text(config.client.name, 20, yPos)

  yPos += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...lightGray)
  doc.text(getClientFullAddress(config), 20, yPos)
  
  // Dates section (right side)
  let dateYPos = 50
  doc.setFontSize(10)
  doc.setTextColor(...lightGray)
  doc.text('Issue Date:', pageWidth - 70, dateYPos)
  doc.setTextColor(...textColor)
  doc.text(formatInvoiceDate(new Date()), pageWidth - 20, dateYPos, { align: 'right' })
  
  dateYPos += 7
  doc.setTextColor(...lightGray)
  doc.text('Due Date:', pageWidth - 70, dateYPos)
  doc.setTextColor(...textColor)
  doc.text(formatInvoiceDate(paymentDate), pageWidth - 20, dateYPos, { align: 'right' })
  
  dateYPos += 7
  doc.setTextColor(...lightGray)
  doc.text('Pay Period:', pageWidth - 102, dateYPos)
  doc.setTextColor(...textColor)
  const periodText = `${formatInvoiceDate(periodStart)} - ${formatInvoiceDate(periodEnd)}`
  doc.text(periodText, pageWidth - 20, dateYPos, { align: 'right' })
  
  // Line separator
  yPos = 85
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(20, yPos, pageWidth - 20, yPos)
  
  // Table
  yPos += 10
  
  const tableData = entries.map(entry => [
    formatTableDate(entry.Date),
    entry.Task,
    entry.Description || '-',
    entry.Hours.toString(),
    formatCurrency(Number(entry.Hours) * config.payment.hourlyRate, config)
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Task', 'Description', 'Hours', 'Amount']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [249, 250, 251],
      textColor: textColor,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      textColor: textColor,
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 28, halign: 'left' },
    },
    margin: { left: 20, right: 20 },
    tableWidth: 'auto',
  })
  
  // Summary section - check if we need a new page
  const pageHeight = doc.internal.pageSize.getHeight()
  const summaryHeight = 100 // Space needed for summary + payment instructions
  yPos = doc.lastAutoTable.finalY + 15
  
  // If not enough space for summary, add a new page
  if (yPos + summaryHeight > pageHeight - 20) {
    doc.addPage()
    yPos = 20
  }
  
  // Summary box
  const summaryX = pageWidth - 90
  doc.setFillColor(249, 250, 251)
  doc.rect(summaryX, yPos - 5, 70, 35, 'F')
  
  doc.setFontSize(10)
  doc.setTextColor(...lightGray)
  doc.text('Total Hours:', summaryX + 5, yPos + 5)
  doc.setTextColor(...textColor)
  doc.text(totalHours.toFixed(2), pageWidth - 25, yPos + 5, { align: 'right' })
  
  doc.setTextColor(...lightGray)
  doc.text('Rate:', summaryX + 5, yPos + 13)
  doc.setTextColor(...textColor)
  doc.text(formatCurrency(config.payment.hourlyRate, config) + '/hr', pageWidth - 25, yPos + 13, { align: 'right' })
  
  doc.setDrawColor(...lightGray)
  doc.line(summaryX + 5, yPos + 18, pageWidth - 25, yPos + 18)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...primaryColor)
  doc.text('Total Due:', summaryX + 5, yPos + 27)
  doc.text(formatCurrency(totalAmount, config), pageWidth - 25, yPos + 27, { align: 'right' })
  
  // Payment instructions
  yPos += 50
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...lightGray)
  doc.text('Payment Instructions:', 20, yPos)
  
  yPos += 7
  doc.setTextColor(...textColor)
  doc.text(`Payment to be E-transferred to ${config.contractor.paymentEmail}`, 20, yPos)
  
  // Footer - add to all pages
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const footerY = pageHeight - 15
    doc.setFontSize(9)
    doc.setTextColor(...lightGray)
    if (totalPages > 1) {
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, footerY, { align: 'right' })
    }
  }
  
  // Save the PDF
  doc.save(`${invoiceNumber}.pdf`)
}
