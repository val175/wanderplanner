/**
 * Lightweight CSV builder + browser download.
 * Keeps expense/budget exports dependency-free.
 */

// RFC-4180 cell escaping: wrap in quotes when the value contains a comma,
// quote, or newline, and double-up any embedded quotes.
function escapeCell(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Build a CSV string from a header array and an array of row arrays.
 */
export function toCsv(headers, rows) {
  const lines = [headers, ...rows].map(cols => cols.map(escapeCell).join(','))
  return lines.join('\r\n')
}

/**
 * Trigger a client-side download of `content` as a file.
 * Prepends a UTF-8 BOM so Excel reads accented characters correctly.
 */
export function downloadCsv(filename, content) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
