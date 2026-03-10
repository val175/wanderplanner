import { useState, useRef, useEffect, useMemo } from 'react'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import AvatarCircle from '../shared/AvatarCircle'
import Select, { SelectItem } from '../shared/Select'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { ACTIONS } from '../../state/tripReducer'
import { buildSplits } from '../../utils/splitwise'

const inputCls = 'w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors'

const LOADING_MESSAGES = [
    "Scanning receipt...",
    "Extracting line items...",
    "Categorizing expenses...",
    "Converting foreign currency...",
    "Crunching the numbers..."
]

const resizeImage = (file, maxDimension = 1280) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > maxDimension) {
                        height *= maxDimension / width
                        width = maxDimension
                    }
                } else {
                    if (height > maxDimension) {
                        width *= maxDimension / height
                        height = maxDimension
                    }
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, width, height)

                // Get optimized base64
                const optimized = canvas.toDataURL('image/jpeg', 0.8)
                console.log(`Payload optimized: ${(e.target.result.length / 1024).toFixed(1)}KB -> ${(optimized.length / 1024).toFixed(1)}KB`)
                resolve(optimized.split(',')[1])
            }
            img.onerror = reject
            img.src = e.target.result
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export default function ReceiptScannerModal({ isOpen, onClose }) {
    const { activeTrip, dispatch } = useTripContext()
    const { currentUserProfile } = useProfiles()
    const travelerProfiles = useTripTravelers()

    const [step, setStep] = useState(1) // 1: Upload, 2: Review
    const [isScanning, setIsScanning] = useState(false)
    const [pendingItems, setPendingItems] = useState([])
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
    const [payerId, setPayerId] = useState('')
    const fileInputRef = useRef(null)

    // Default payer to current user or first traveler
    useEffect(() => {
        if (isOpen) {
            setPayerId(currentUserProfile?.uid || activeTrip?.travelersSnapshot?.[0]?.uid || '')
            setStep(1)
            setIsScanning(false)
            setPendingItems([])
        }
    }, [isOpen, currentUserProfile?.uid, activeTrip?.travelersSnapshot])

    // Loading message rotation
    useEffect(() => {
        if (isScanning) {
            const id = setInterval(() => {
                setLoadingMessageIndex(idx => (idx + 1) % LOADING_MESSAGES.length)
            }, 2500)
            return () => clearInterval(id)
        } else {
            setLoadingMessageIndex(0)
        }
    }, [isScanning])

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setIsScanning(true)
        try {
            const base64String = await resizeImage(file)

            // Get auth token
            let token = ''
            try {
                const { auth } = await import('../../firebase/config')
                token = await auth.currentUser?.getIdToken()
            } catch (err) {
                console.warn('Could not get auth token for scan', err)
            }

            const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/budget/scan-receipt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({ imageBase64: base64String })
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.error || `Scan failed (Status ${response.status})`)
            }

            const result = await response.json()
            const originalCurrency = (result.currency || 'PHP').toUpperCase()

            let rate = 1
            if (originalCurrency !== 'PHP') {
                try {
                    const rateRes = await fetch(`https://api.exchangerate-api.com/v4/latest/${originalCurrency}`)
                    if (rateRes.ok) {
                        const rateData = await rateRes.json()
                        rate = rateData.rates['PHP'] || 1
                    }
                } catch (err) {
                    console.warn('Currency conversion failed', err)
                }
            }

            const budget = activeTrip.budget || []
            const sanitisedItems = (result.items || []).map(item => {
                const matched = budget.find(c => c.name.toLowerCase() === item.category.toLowerCase())
                return {
                    ...item,
                    category: matched ? matched.name : (budget[0]?.name || 'Misc'),
                    originalAmount: item.amount,
                    originalCurrency: originalCurrency,
                    amountPHP: Number((item.amount * rate).toFixed(2))
                }
            })

            setPendingItems(sanitisedItems)
            setStep(2)
        } catch (err) {
            console.error('Scan Error:', err)
            alert(err.message)
        } finally {
            setIsScanning(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const updateItem = (idx, field, value) => {
        setPendingItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
    }

    const removeItem = (idx) => {
        setPendingItems(prev => {
            const next = prev.filter((_, i) => i !== idx)
            if (next.length === 0) {
                setStep(1)
                return []
            }
            return next
        })
    }

    const handleApprove = () => {
        const travelerIds = activeTrip.travelersSnapshot.map(p => p.uid || p.id)

        pendingItems.forEach(item => {
            const splits = buildSplits(item.amountPHP, travelerIds, 'equal')
            dispatch({
                type: ACTIONS.ADD_SPENDING,
                payload: {
                    description: item.description,
                    amount: item.amountPHP,
                    category: item.category,
                    paidBy: payerId,
                    splitBetween: travelerIds,
                    splits,
                    splitMode: 'equal',
                }
            })
        })

        onClose()
    }

    const totalLog = pendingItems.reduce((s, i) => s + (i.amountPHP || 0), 0)

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Itemized Receipt Scanner" maxWidth="max-w-xl">
            <div className="p-6">
                {step === 1 && !isScanning && (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-[var(--radius-lg)] bg-bg-secondary/20 transition-colors hover:bg-bg-secondary/30">
                        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4 text-3xl">
                            📸
                        </div>
                        <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">Scan a Receipt</h3>
                        <p className="text-sm text-text-muted mb-6 px-8 text-center font-medium">
                            Upload a photo of your receipt and we'll automatically extract line items and convert prices to PHP.
                        </p>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        <Button onClick={() => fileInputRef.current?.click()} size="lg">
                            Choose Photo
                        </Button>
                    </div>
                )}

                {isScanning && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-5 animate-fade-in text-center">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                            <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-accent rounded-full border-t-transparent animate-spin"></div>
                            <span className="text-2xl animate-pulse">🧾</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-heading font-semibold text-text-primary mb-1">
                                {LOADING_MESSAGES[loadingMessageIndex]}
                            </h3>
                            <p className="text-sm text-text-muted">This usually takes about 10-15 seconds.</p>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Paid By Selector */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="block text-xs text-text-muted uppercase tracking-wider font-medium">Paid By</label>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted cursor-help opacity-60 hover:opacity-100 transition-opacity" title="This traveler will be logged as the payer for all items in this receipt. Individual splits remain equal between everyone.">
                                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                            </div>
                            <Select value={payerId} onValueChange={setPayerId} size="lg">
                                {travelerProfiles?.map(p => (
                                    <SelectItem key={p.uid || p.id} value={p.uid || p.id}>
                                        {p.name}{p.uid === currentUserProfile?.uid ? ' (you)' : ''}
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>

                        {/* List Review */}
                        <div className="space-y-2.5">
                            <label className="block text-xs font-semibold uppercase tracking-widest text-text-muted">Review Items</label>
                            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 scrollbar-thin">
                                {pendingItems.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2 bg-bg-secondary/40 p-3 rounded-[var(--radius-md)] border border-border/60 group">
                                        <div className="flex-1 space-y-2">
                                            <input
                                                value={item.description}
                                                onChange={e => updateItem(idx, 'description', e.target.value)}
                                                className={inputCls + ' !py-1'}
                                                placeholder="Description"
                                            />
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <Select value={item.category} onValueChange={v => updateItem(idx, 'category', v)} size="sm" className="text-xs">
                                                        {activeTrip.budget?.map(c => <SelectItem key={c.id} value={c.name}>{c.emoji} {c.name}</SelectItem>)}
                                                    </Select>
                                                </div>
                                                <div className="w-32 relative">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">₱</span>
                                                    <input
                                                        type="number"
                                                        value={item.amountPHP}
                                                        onChange={e => updateItem(idx, 'amountPHP', Number(e.target.value))}
                                                        className={inputCls + ' !py-1 !pl-6 !text-xs text-right font-mono'}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-text-muted pl-1">
                                                Original: {item.originalCurrency} {item.originalAmount}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeItem(idx)}
                                            className="p-1.5 text-text-muted hover:text-danger rounded-md transition-colors mt-1"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-border">
                            <div className="text-sm font-semibold text-text-primary">
                                Total: ₱{totalLog.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => setStep(1)}>
                                    Rescan
                                </Button>
                                <Button onClick={handleApprove}>
                                    Approve & Log
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}
