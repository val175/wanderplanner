import { useState, useEffect, useRef } from 'react'
import { auth } from '../../../firebase/config'

const LOADING_MESSAGES = [
  "Reading the travel blog...",
  "Whipping up your itinerary...",
  "Finding the best destinations...",
  "Estimating budget costs...",
  "Packing your bags..."
]

export default function MagicImportFlow({ onPlanReady, onBack }) {
  const [importUrl, setImportUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isImporting) {
      const id = setInterval(() => {
        setLoadingMessageIndex(idx => (idx + 1) % LOADING_MESSAGES.length)
      }, 2500)
      return () => clearInterval(id)
    } else {
      setLoadingMessageIndex(0)
    }
  }, [isImporting])

  const handleImport = async () => {
    if (!importUrl && !selectedFile) return
    setIsImporting(true)
    setImportError('')
    try {
      let token = ''
      if (auth.currentUser) token = await auth.currentUser.getIdToken()
      
      let res;
      if (selectedFile) {
        // Convert PDF to base64 and send directly (keep files compressed before importing)
        const reader = new FileReader()
        const base64Data = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(selectedFile)
        })

        res = await fetch('https://wanderplan-rust.vercel.app/api/extract-trip-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({ file: base64Data })
        });
      } else {
        // Handle URL import
        res = await fetch('https://wanderplan-rust.vercel.app/api/extract-trip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({ url: importUrl })
        })
      }
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to extract trip data')
      if (data.success && data.data) {
        onPlanReady(data.data, { sourceUrl: selectedFile ? selectedFile.name : importUrl })
      }
    } catch (err) {
      setImportError(err.message)
    } finally {
      setIsImporting(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setImportUrl(''); // clear URL if file is selected
      setImportError('');
    } else if (file) {
      setImportError('Only PDF files are supported.');
      e.target.value = null; // clear invalid selection
    }
  }

  if (isImporting) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-5 animate-fade-in text-center">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-accent rounded-full border-t-transparent animate-spin"></div>
          <span className="text-2xl animate-pulse">✨</span>
        </div>
        <div>
          <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">
            {LOADING_MESSAGES[loadingMessageIndex]}
          </h3>
          <p className="text-sm text-text-muted">This usually takes about 10-15 seconds.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 pt-4 pb-6 space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack}
          className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h2 className="font-heading font-semibold text-xl text-text-primary">✨ Magic Import</h2>
          <p className="text-sm text-text-muted">Paste a travel blog URL and we'll draft your trip.</p>
        </div>
      </div>

      <div className="p-4 bg-accent-muted/20 border border-accent/20 rounded-[var(--radius-lg)]">
        <p className="text-xs text-text-muted mb-3">Works great with Nomadic Matt, The Blonde Abroad, Travel + Leisure, and more.</p>
        <div className="flex flex-col gap-4">
          
          <input
            type="url"
            value={importUrl}
            onChange={e => {
              setImportUrl(e.target.value);
              if (selectedFile) setSelectedFile(null);
            }}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
            placeholder="e.g. nomadicmatt.com/japan-itinerary"
            autoFocus
            className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          />
          
          <div className="flex items-center gap-3">
             <div className="h-[1px] flex-1 bg-border/50"></div>
             <span className="text-xs text-text-muted uppercase font-medium tracking-wider">or</span>
             <div className="h-[1px] flex-1 bg-border/50"></div>
          </div>
          
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-3 text-sm py-2 border border-dashed border-border hover:border-accent/50 rounded-[var(--radius-md)] text-text-secondary hover:text-text-primary transition-colors bg-bg-primary/50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
               <polyline points="17 8 12 3 7 8" />
               <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {selectedFile ? selectedFile.name : 'Upload PDF Itinerary'}
          </button>
          
        </div>
        {importError && <p className="text-xs text-danger mt-2">{importError}</p>}
        
        <button
          type="button"
          onClick={handleImport}
          disabled={isImporting || (!importUrl && !selectedFile)}
          className="mt-4 w-full px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          Generate
        </button>
      </div>
    </div>
  )
}
