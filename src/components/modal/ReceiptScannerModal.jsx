import { useState, useRef, useEffect, useMemo } from 'react'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import AvatarCircle from '../shared/AvatarCircle'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { buildSplits } from '../../utils/splitwise'

const inputCls = 'w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors'
const selectCls = 'w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:border-accent focus:outline-none transition-colors'

const LOADING_MESSAGES = [
    "Scanning receipt...",
    "Extracting line items...",
    "Categorizing expenses...",
    "Converting foreign currency...",
    "Crunching the numbers..."
]

export default function ReceiptScannerModal({ isOpen, onClose }) {
    const { activeTrip, dispatch } = useTripContext()
    const { currentUserProfile } = useProfiles()

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
            const reader = new FileReader()
            reader.onloadend = async () => {
                try {
                    const base64String = reader.result.split(',')[1]

                    // Get auth token
                    let token = ''
                    try {
                        const { auth } = await import('../../firebase/config')
                        token = await auth.currentUser?.getIdToken()
                    } catch (err) {
                        console.warn('Could not get auth token for scan', err)
                    }

                    const response = await fetch('/api/budget/scan-receipt', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token && { 'Authorization': `Bearer ${token}` })
                        },
                        body: JSON.stringify({ image: base64String })
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
                }
            }
            reader.readAsDataURL(file)
        } catch (err) {
            setIsScanning(false)
            console.error('File Read Error:', err)
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
                        <p className="text-sm text-text-muted mb-6 px-8 text-center">
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
                            <h3 className="text-xl font-heading font-bold text-text-primary mb-1">
                                {LOADING_MESSAGES[loadingMessageIndex]}
                            </h3>
                            <p className="text-sm text-text-muted">This usually takes about 10-15 seconds.</p>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Paid By Selector */}
                        <div className="space-y-2.5">
                            <label className="block text-xs font-bold uppercase tracking-widest text-text-muted">Paid By</label>
                            <div className="flex flex-wrap gap-2">
                                {activeTrip.travelersSnapshot?.map(p => {
                                    const id = p.uid || p.id
                                    const selected = payerId === id
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => setPayerId(id)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)] border text-sm transition-all duration-150
                        ${selected
                                                    ? 'bg-accent/10 border-accent/40 text-text-primary'
                                                    : 'bg-bg-secondary border-border text-text-muted hover:border-accent/30 hover:text-text-secondary'
                                                }`}
                                        >
                                            <AvatarCircle profile={p} size={22} />
                                            <span className="font-medium">{p.name}{id === currentUserProfile?.uid ? ' (you)' : ''}</span>
                                            {selected && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* List Review */}
                        <div className="space-y-2.5">
                            <label className="block text-xs font-bold uppercase tracking-widest text-text-muted">Review Items</label>
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
                                                <select
                                                    value={item.category}
                                                    onChange={e => updateItem(idx, 'category', e.target.value)}
                                                    className={selectCls + ' !py-1 !text-xs flex-1'}
                                                >
                                                    {activeTrip.budget?.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}
                                                </select>
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
                            <div className="text-sm font-bold text-text-primary">
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
