import { useState, useEffect, useRef, useMemo } from 'react'
import api from '../services/api'
import { Alert } from '../components/ui/Alert'

interface BatchInfo {
  batchId: string
  batchNumber: string
  expiryDate: string
  mrp: number
  quantityRemaining: number
}

interface DrugItem {
  id: string
  name: string
  genericName: string
  therapeuticCategory: string
  dosageForm: string
  strength: string
  scheduleClass: string
  hsnCode: string
  gstRate: number
  indicativeMrp: number
  totalStock: number
  commonBrands?: string
  earliestBatch?: BatchInfo
}

interface CartItem {
  drugId: string
  drugName: string
  genericName: string
  scheduleClass: string
  batchId: string
  batchNumber: string
  expiryDate: string
  quantity: number
  maxStock: number
  unitPrice: number
  gstRate: number
  hsnCode: string
}

interface CompletedInvoice {
  invoiceId: string
  invoiceNumber: string
  subtotal: number
  gstAmount: number
  total: number
  tenderedAmount: number
  changeDue: number
  paymentMethod: string
  createdAt: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    amount: number
    gstRate: number
    hsnCode: string
  }>
}

export default function PharmacyPOS() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DrugItem[]>([])
  const [searching, setSearching] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])

  // Customer & Prescriber details
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [prescriberName, setPrescriberName] = useState('')
  const [prescriberRegNo, setPrescriberRegNo] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI'>('Cash')
  const [tenderedAmount, setTenderedAmount] = useState<number | ''>('')

  // Modals & State
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [completedInvoice, setCompletedInvoice] = useState<CompletedInvoice | null>(null)
  const [activeSubstituteDrug, setActiveSubstituteDrug] = useState<DrugItem | null>(null)
  const [substitutesList, setSubstitutesList] = useState<any[]>([])
  const [loadingSubstitutes, setLoadingSubstitutes] = useState(false)

  const [defaultCatalog, setDefaultCatalog] = useState<DrugItem[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const performSearch = async (queryText: string) => {
    const q = queryText.trim()
    if (!q) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await api.get('/pharmacy/drugs', {
        params: { query: q, inStockOnly: false, pageSize: 20 }
      })
      setSearchResults(res.data.drugs || [])
    } catch (err: any) {
      console.error('Failed to search drugs', err)
    } finally {
      setSearching(false)
    }
  }

  // Load initial essential catalog on mount & focus input
  useEffect(() => {
    searchInputRef.current?.focus()
    const loadInitialCatalog = async () => {
      try {
        const res = await api.get('/pharmacy/drugs', {
          params: { inStockOnly: false, pageSize: 20 }
        })
        setDefaultCatalog(res.data.drugs || [])
      } catch (err) {
        console.error('Failed to load initial catalog', err)
      }
    }
    loadInitialCatalog()
  }, [])

  // Auto search on query debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery)
    }, 150)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Cart calculations
  const { subtotal, totalGst, grandTotal, hasScheduleH1 } = useMemo(() => {
    let sub = 0
    let gst = 0
    let schedH1 = false

    cart.forEach(item => {
      const lineTotal = item.unitPrice * item.quantity
      const lineGst = Math.round(lineTotal * (item.gstRate / 100) * 100) / 100
      sub += lineTotal
      gst += lineGst

      if (['ScheduleH1', 'NDPS', 'ScheduleX'].includes(item.scheduleClass)) {
        schedH1 = true
      }
    })

    return {
      subtotal: sub,
      totalGst: gst,
      grandTotal: sub + gst,
      hasScheduleH1: schedH1
    }
  }, [cart])

  // Add drug to cart using FEFO (earliest available batch)
  const addToCart = async (drug: DrugItem) => {
    setError('')
    try {
      // Fetch fresh FEFO batches
      const res = await api.get(`/pharmacy/drugs/${drug.id}/batches/fefo`)
      const batches = res.data as Array<{
        id: string
        batchNumber: string
        expiryDate: string
        quantityRemaining: number
        mrp: number
      }>

      if (!batches || batches.length === 0) {
        setError(`No active stock found for "${drug.name}". Try searching for generic substitutes.`)
        return
      }

      const fefoBatch = batches[0] // Earliest non-expired batch

      // Check if already in cart
      const existingIndex = cart.findIndex(c => c.batchId === fefoBatch.id)
      if (existingIndex > -1) {
        const existing = cart[existingIndex]
        if (existing.quantity >= fefoBatch.quantityRemaining) {
          setError(`Max available stock (${fefoBatch.quantityRemaining}) already added for batch ${fefoBatch.batchNumber}.`)
          return
        }
        setCart(prev => prev.map((item, idx) => idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item))
      } else {
        setCart(prev => [
          ...prev,
          {
            drugId: drug.id,
            drugName: drug.name,
            genericName: drug.genericName,
            scheduleClass: drug.scheduleClass,
            batchId: fefoBatch.id,
            batchNumber: fefoBatch.batchNumber,
            expiryDate: fefoBatch.expiryDate,
            quantity: 1,
            maxStock: fefoBatch.quantityRemaining,
            unitPrice: fefoBatch.mrp,
            gstRate: drug.gstRate || 12,
            hsnCode: drug.hsnCode || '30049099'
          }
        ])
      }

      setSearchQuery('')
      setSearchResults([])
      searchInputRef.current?.focus()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to select FEFO batch')
    }
  }

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index)
      return
    }
    setCart(prev => prev.map((item, idx) => {
      if (idx === index) {
        if (newQty > item.maxStock) {
          setError(`Cannot exceed available batch stock (${item.maxStock})`)
          return { ...item, quantity: item.maxStock }
        }
        return { ...item, quantity: newQty }
      }
      return item
    }))
  }

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, idx) => idx !== index))
  }

  const clearCart = () => {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setPrescriberName('')
    setPrescriberRegNo('')
    setTenderedAmount('')
    setError('')
  }

  // Find Generic Molecule Substitutes
  const openSubstitutes = async (drug: DrugItem) => {
    setActiveSubstituteDrug(drug)
    setLoadingSubstitutes(true)
    setSubstitutesList([])
    try {
      const res = await api.get(`/pharmacy/substitutes/${drug.id}`)
      setSubstitutesList(res.data.substitutes || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSubstitutes(false)
    }
  }

  // Handle POS Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError('Cart is empty.')
      return
    }

    if (hasScheduleH1) {
      if (!prescriberName.trim() || !prescriberRegNo.trim()) {
        setError('Schedule H1 / NDPS medicines legally require Prescribing Doctor Name and Registration No. before dispensing.')
        return
      }
      if (!customerName.trim()) {
        setError('Patient / Customer name is mandatory for Schedule H1 controlled substance register.')
        return
      }
    }

    setError('')
    setSubmitting(true)

    const payload = {
      walkInCustomerName: customerName.trim() || 'Walk-in Customer',
      walkInCustomerPhone: customerPhone.trim() || undefined,
      prescriberName: prescriberName.trim() || undefined,
      prescriberRegNo: prescriberRegNo.trim() || undefined,
      paymentMethod,
      tenderedAmount: typeof tenderedAmount === 'number' ? tenderedAmount : grandTotal,
      items: cart.map(c => ({
        drugId: c.drugId,
        drugBatchId: c.batchId,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        gstRate: c.gstRate,
        hsnCode: c.hsnCode
      }))
    }

    try {
      const res = await api.post('/pharmacy/checkout', payload)
      setCompletedInvoice(res.data)
      clearCart()
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Checkout transaction failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const printReceipt = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
              POS Fast Checkout
            </span>
            <span className="text-xs text-slate-500 font-mono">FEFO Stock Auto-Allocation</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Pharmacy Counter POS</h1>
          <p className="text-sm text-slate-500">
            Instant barcode / text search, multi-slab GST calculation, and statutory Schedule H1 compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => clearCart()}
            className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
          >
            Clear Cart
          </button>
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}

      {/* ── Main Layout: POS Cart on Right, Drug Search on Left ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Drug Search & Catalog Selector (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Scan Barcode or Search Medicine / Generic Salt
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="e.g. Augmentin 625, Paracetamol, Dolo, Pan 40, Metformin..."
                className="w-full pl-10 pr-4 py-3 text-base rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-medium"
              />
              <div className="absolute left-3.5 top-3.5 text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searching && (
                <div className="absolute right-3.5 top-3.5">
                  <span className="spinner spinner-sm" />
                </div>
              )}
            </div>

            {/* Search Results or Default Catalog */}
            {(() => {
              const displayList = searchQuery.trim() ? searchResults : defaultCatalog
              const isSearchMode = Boolean(searchQuery.trim())

              if (isSearchMode && searchResults.length === 0 && !searching) {
                return (
                  <div className="mt-3 p-6 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm">
                    No medicines found matching <span className="font-semibold text-slate-700">"{searchQuery}"</span>.
                  </div>
                )
              }

              if (displayList.length === 0) return null

              return (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {isSearchMode ? `Search Matches (${displayList.length})` : `Popular Formulations (${displayList.length})`}
                    </span>
                    {!isSearchMode && (
                      <span className="text-[11px] text-emerald-700 font-medium">Quick POS Access</span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-[420px] overflow-y-auto bg-slate-50">
                    {displayList.map(drug => {
                      const inStock = drug.totalStock > 0
                      const isH1 = ['ScheduleH1', 'NDPS', 'ScheduleX'].includes(drug.scheduleClass)

                      return (
                        <div
                          key={drug.id}
                          className="p-3 bg-white hover:bg-emerald-50/50 transition flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm">{drug.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                                {drug.dosageForm} {drug.strength}
                              </span>
                              {isH1 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  {drug.scheduleClass} (Rx Req)
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700">
                                GST {drug.gstRate}%
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              <span className="font-medium text-slate-600">Salt:</span> {drug.genericName}
                              {drug.commonBrands && <span className="ml-2 text-slate-400">({drug.commonBrands})</span>}
                            </p>
                            {drug.earliestBatch && (
                              <p className="text-[11px] text-slate-600 mt-1">
                                FEFO Batch: <span className="font-mono font-semibold">{drug.earliestBatch.batchNumber}</span> (Exp: {drug.earliestBatch.expiryDate}) • MRP: ₹{drug.earliestBatch.mrp.toFixed(2)}
                              </p>
                            )}
                          </div>

                          <div className="text-right flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-xs font-bold ${inStock ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {inStock ? `${drug.totalStock} in stock` : 'Out of Stock'}
                            </span>
                            
                            <div className="flex items-center gap-1.5">
                              {inStock ? (
                                <button
                                  onClick={() => addToCart(drug)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition flex items-center gap-1 cursor-pointer"
                                >
                                  <span>+ Add</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => openSubstitutes(drug)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-md text-[11px] font-semibold transition cursor-pointer"
                                >
                                  Substitutes
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Quick Category / Prescription Helper info */}
          <div className="bg-slate-100 rounded-xl p-4 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Statutory Compliance Rules
            </h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li><strong className="text-slate-800">Schedule H1 & NDPS:</strong> Mandatory automatic capture into Controlled Substance Register with Doctor Reg # and Patient details.</li>
              <li><strong className="text-slate-800">FEFO Allocation:</strong> Earliest non-expired batch is automatically chosen first to prevent dead stock.</li>
              <li><strong className="text-slate-800">Unified Billing:</strong> POS receipts write directly to the clinic payments table and reconcile 100% with the Finance Ledger.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Billing POS Cart & Tender (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Current Order Cart</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                  {cart.length} items
                </span>
              </h2>
              {hasScheduleH1 && (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                  ⚠️ Schedule H1 Contained
                </span>
              )}
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <p>No medicines added yet.</p>
                <p className="text-xs mt-1">Scan barcode or search medicines on the left.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                {cart.map((item, idx) => (
                  <div key={item.batchId} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{item.drugName}</p>
                      <p className="text-[11px] text-slate-500">
                        Batch: <span className="font-mono">{item.batchNumber}</span> (Exp: {item.expiryDate}) • GST {item.gstRate}%
                      </p>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">
                        ₹{item.unitPrice.toFixed(2)} × {item.quantity} = <strong className="text-slate-900">₹{(item.unitPrice * item.quantity).toFixed(2)}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-slate-300 rounded-md overflow-hidden bg-white">
                        <button
                          onClick={() => updateQuantity(idx, item.quantity - 1)}
                          className="px-2 py-0.5 text-slate-600 hover:bg-slate-100 font-bold"
                        >
                          -
                        </button>
                        <span className="px-2.5 py-0.5 font-semibold text-xs text-slate-800 min-w-[24px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(idx, item.quantity + 1)}
                          className="px-2 py-0.5 text-slate-600 hover:bg-slate-100 font-bold"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Customer Details */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase">Customer / Patient Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full mt-1 px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase">Phone Number</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full mt-1 px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Schedule H1 Prescriber Mandatory Form (shows when cart contains H1) */}
              {hasScheduleH1 && (
                <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-1 text-amber-900 font-bold text-xs">
                    <span>⚠️ Statutory Prescription Requirement</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 uppercase">Prescribing Doctor *</label>
                      <input
                        type="text"
                        value={prescriberName}
                        onChange={e => setPrescriberName(e.target.value)}
                        placeholder="Dr. S. Sharma"
                        className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-amber-300 bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 uppercase">Doctor Reg # *</label>
                      <input
                        type="text"
                        value={prescriberRegNo}
                        onChange={e => setPrescriberRegNo(e.target.value)}
                        placeholder="MCI-12345/2018"
                        className="w-full mt-0.5 px-2 py-1 text-xs rounded border border-amber-300 bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment & Summary */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal (Excl. Tax):</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>GST Tax Breakdown:</span>
                <span>₹{totalGst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Grand Total:</span>
                <span className="text-emerald-700">₹{grandTotal.toFixed(2)}</span>
              </div>

              {/* Payment Method Selector */}
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Tender Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Card'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        paymentMethod === method
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'Cash' && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase">Cash Tendered</label>
                    <input
                      type="number"
                      value={tenderedAmount}
                      onChange={e => setTenderedAmount(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder={grandTotal.toFixed(2)}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs rounded border border-slate-300 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase">Change Due</label>
                    <div className="mt-1 px-2.5 py-1.5 text-xs rounded bg-slate-100 font-bold text-emerald-800">
                      ₹{typeof tenderedAmount === 'number' && tenderedAmount > grandTotal
                        ? (tenderedAmount - grandTotal).toFixed(2)
                        : '0.00'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Checkout Action Button */}
            <button
              onClick={handleCheckout}
              disabled={submitting || cart.length === 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" />
                  Processing Sale…
                </>
              ) : (
                `Complete Sale (₹${grandTotal.toFixed(2)})`
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Generic Substitutes Modal ── */}
      {activeSubstituteDrug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Generic Molecule Substitutes</h3>
                <p className="text-xs text-slate-500">
                  Showing in-stock alternative brands for <strong className="text-slate-800">{activeSubstituteDrug.name}</strong> ({activeSubstituteDrug.genericName})
                </p>
              </div>
              <button
                onClick={() => setActiveSubstituteDrug(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {loadingSubstitutes ? (
              <div className="py-8 text-center text-sm text-slate-500">
                <span className="spinner spinner-md" /> Searching generic salt equivalents…
              </div>
            ) : substitutesList.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No matching generic salt alternatives currently found in catalog.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {substitutesList.map(sub => (
                  <div key={sub.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{sub.name}</p>
                      <p className="text-xs text-slate-500">{sub.dosageForm} {sub.strength} • MRP: ₹{sub.indicativeMrp.toFixed(2)}</p>
                      <p className="text-[11px] text-emerald-700 font-semibold">{sub.totalStock} units available</p>
                    </div>

                    <button
                      disabled={!sub.inStock}
                      onClick={() => {
                        addToCart(sub)
                        setActiveSubstituteDrug(null)
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition"
                    >
                      {sub.inStock ? '+ Select Brand' : 'Out of Stock'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Thermal Receipt & Invoice Print Preview Modal ── */}
      {completedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 print:border-none print:shadow-none print:w-full">
            
            {/* Header / Actions (Hidden in Print) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-slate-900 text-sm">Sale Completed</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={printReceipt}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H7a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Receipt
                </button>
                <button
                  onClick={() => setCompletedInvoice(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 80mm Printable Thermal Slip Format */}
            <div className="font-mono text-xs text-slate-800 space-y-2 border border-slate-200 p-4 rounded bg-slate-50 print:bg-white print:border-none print:p-0">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                <p className="font-bold text-sm tracking-wide">SAMSTACK HEALTHCARE PHARMACY</p>
                <p className="text-[10px]">DL No: 20B/21B-MH-102938 • GSTIN: 27AABCS9912E1Z4</p>
                <p className="text-[10px]">Tax Invoice / Cash Receipt</p>
              </div>

              <div className="flex justify-between text-[11px] pt-1">
                <span>Invoice: <strong>{completedInvoice.invoiceNumber}</strong></span>
                <span>{new Date(completedInvoice.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="text-[11px]">
                <span>Tender: {completedInvoice.paymentMethod}</span>
              </div>

              <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-1">
                <div className="grid grid-cols-12 font-bold text-[10px] text-slate-600">
                  <span className="col-span-6">Item (Batch)</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-2 text-right">Price</span>
                  <span className="col-span-2 text-right">Amt</span>
                </div>
                {completedInvoice.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 text-[10px]">
                    <span className="col-span-6 truncate">{it.description}</span>
                    <span className="col-span-2 text-center">{it.quantity}</span>
                    <span className="col-span-2 text-right">₹{it.unitPrice.toFixed(2)}</span>
                    <span className="col-span-2 text-right">₹{it.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 pt-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{completedInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST Amount:</span>
                  <span>₹{completedInvoice.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1">
                  <span>Total Paid:</span>
                  <span>₹{completedInvoice.total.toFixed(2)}</span>
                </div>
                {completedInvoice.changeDue > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-800">
                    <span>Change Returned:</span>
                    <span>₹{completedInvoice.changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[9px] text-slate-500 border-t border-dashed border-slate-400 pt-2">
                <p>Thank you for choosing us! Get well soon.</p>
                <p>Prescription drugs sold under licensed pharmacist supervision.</p>
              </div>
            </div>

            {/* Modal Bottom Close */}
            <div className="pt-2 flex justify-end print:hidden">
              <button
                onClick={() => setCompletedInvoice(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition"
              >
                New Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
