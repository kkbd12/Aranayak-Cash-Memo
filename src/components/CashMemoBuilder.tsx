import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Save,
  RotateCcw,
  User,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Package,
  Check,
  Search,
  UserCheck,
  Users,
  Gift,
} from 'lucide-react';
import { CashMemo, MemoItem, Product, ShopSettings, PaymentMethod } from '../types';

interface CashMemoBuilderProps {
  shopSettings: ShopSettings;
  products: Product[];
  memos?: CashMemo[];
  onSaveMemo: (memo: Omit<CashMemo, 'id' | 'createdAt'>) => Promise<CashMemo | null>;
  onPrintMemo: (memo: CashMemo) => void;
  lang: 'bn' | 'en';
}

export const CashMemoBuilder: React.FC<CashMemoBuilderProps> = ({
  shopSettings,
  products,
  memos = [],
  onSaveMemo,
  onPrintMemo,
  lang,
}) => {
  const isBn = lang === 'bn';
  const currency = shopSettings.currencySymbol || '৳';

  // Customer State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);

  // Extract unique previous customers from memos
  const previousCustomers = React.useMemo(() => {
    if (!memos || memos.length === 0) return [];
    const map = new Map<string, { name: string; phone: string; address: string }>();

    memos.forEach((m) => {
      const name = (m.customerName || '').trim();
      const phone = (m.customerPhone || '').trim();
      const address = (m.customerAddress || '').trim();

      if (name || phone) {
        const key = (phone || name).toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name, phone, address });
        } else {
          const existing = map.get(key)!;
          if (!existing.address && address) existing.address = address;
          if (!existing.phone && phone) existing.phone = phone;
          if (!existing.name && name) existing.name = name;
        }
      }
    });

    return Array.from(map.values());
  }, [memos]);

  // Filter customer suggestions
  const nameSuggestions = React.useMemo(() => {
    if (!customerName.trim() || previousCustomers.length === 0) return [];
    const q = customerName.toLowerCase();
    return previousCustomers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customerName, previousCustomers]);

  const phoneSuggestions = React.useMemo(() => {
    if (!customerPhone.trim() || previousCustomers.length === 0) return [];
    const q = customerPhone.toLowerCase();
    return previousCustomers.filter((c) => c.phone.toLowerCase().includes(q));
  }, [customerPhone, previousCustomers]);

  const selectCustomer = (cust: { name: string; phone: string; address: string }) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setCustomerAddress(cust.address);
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
  };

  const [memoNo, setMemoNo] = useState('');
  const [memoDate, setMemoDate] = useState(new Date().toISOString().split('T')[0]);
  const [memoTime, setMemoTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  // Items State
  const [items, setItems] = useState<MemoItem[]>([
    {
      id: 'item-1',
      name: '',
      unitPrice: 0,
      quantity: 1,
      unit: 'পিস',
      total: 0,
    },
  ]);

  // Billing State
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [shipping, setShipping] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchProductQuery, setSearchProductQuery] = useState('');

  // Auto-fill next memo number when shopSettings change
  useEffect(() => {
    if (shopSettings.invoicePrefix && shopSettings.nextMemoNumber) {
      setMemoNo(`${shopSettings.invoicePrefix}${shopSettings.nextMemoNumber}`);
    }
  }, [shopSettings]);

  // Handle Item Row Changes
  const updateItem = (id: string, field: keyof MemoItem, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'isGift') {
            const isGift = Boolean(value);
            updated.isGift = isGift;
            updated.total = isGift ? 0 : (item.unitPrice * item.quantity);
            if (isGift && !updated.giftNote) {
              updated.giftNote = isBn ? 'ফ্রি / উপহার' : 'Free Gift';
            }
          } else if (field === 'unitPrice' || field === 'quantity') {
            const price = field === 'unitPrice' ? Number(value) || 0 : item.unitPrice;
            const qty = field === 'quantity' ? Number(value) || 0 : item.quantity;
            updated.total = updated.isGift ? 0 : (price * qty);
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Select Product from Dropdown
  const selectProductForItem = (rowId: string, productId: string) => {
    const selected = products.find((p) => p.id === productId);
    if (!selected) return;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === rowId) {
          return {
            ...item,
            productId: selected.id,
            name: selected.name,
            unitPrice: selected.price,
            unit: selected.unit,
            total: item.isGift ? 0 : (selected.price * item.quantity),
          };
        }
        return item;
      })
    );
  };

  const addItemRow = () => {
    const newRow: MemoItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      name: '',
      unitPrice: 0,
      quantity: 1,
      unit: 'পিস',
      total: 0,
      isGift: false,
    };
    setItems((prev) => [...prev, newRow]);
  };

  const addGiftItemRow = () => {
    const newRow: MemoItem = {
      id: `gift-${Date.now()}-${Math.random()}`,
      name: '',
      unitPrice: 0,
      quantity: 1,
      unit: 'পিস',
      total: 0,
      isGift: true,
      giftNote: isBn ? 'ফ্রি / গিফট' : 'Free Gift',
    };
    setItems((prev) => [...prev, newRow]);
  };

  const removeItemRow = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  
  const discountAmount =
    discountType === 'percent' ? (subtotal * (discount || 0)) / 100 : Number(discount) || 0;

  const totalAmount = Math.max(0, subtotal - discountAmount + (Number(shipping) || 0));
  
  const dueAmount = Math.max(0, totalAmount - (Number(paidAmount) || 0));
  const returnChange = Math.max(0, (Number(paidAmount) || 0) - totalAmount);

  // Default paid amount to total amount when total amount changes and paid wasn't modified
  const handleFullPayment = () => {
    setPaidAmount(totalAmount);
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setItems([
      {
        id: `item-${Date.now()}`,
        name: '',
        unitPrice: 0,
        quantity: 1,
        unit: 'পিস',
        total: 0,
      },
    ]);
    setDiscount(0);
    setShipping(0);
    setPaidAmount(0);
    setNotes('');
    setErrorMessage('');
    if (shopSettings.invoicePrefix && shopSettings.nextMemoNumber) {
      setMemoNo(`${shopSettings.invoicePrefix}${shopSettings.nextMemoNumber}`);
    }
  };

  const handleSaveAndAction = async (andPrint: boolean) => {
    setErrorMessage('');
    // Basic validation
    const validItems = items.filter((i) => i.name.trim() !== '' && i.quantity > 0);
    if (validItems.length === 0) {
      setErrorMessage(isBn ? 'দয়া করে অন্তত একটি পণ্যের নাম ও বিবরণ দিন!' : 'Please enter at least one valid product!');
      return;
    }

    setIsSaving(true);
    try {
      const status: 'Paid' | 'Partial' | 'Due' =
        paidAmount >= totalAmount ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Due';

      const memoPayload = {
        memoNo: memoNo || `MEMO-${Date.now()}`,
        date: memoDate,
        time: memoTime,
        customerName: customerName.trim() || (isBn ? 'খুচরা ক্রেতা' : 'Retail Customer'),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        items: validItems,
        subtotal,
        discount: discountAmount,
        discountType,
        tax: 0,
        shipping: Number(shipping) || 0,
        totalAmount,
        paidAmount: Number(paidAmount) || 0,
        dueAmount,
        paymentMethod,
        status,
        notes,
      };

      const savedMemo = await onSaveMemo(memoPayload);
      if (savedMemo) {
        if (andPrint) {
          onPrintMemo(savedMemo);
        }
        resetForm();
      }
    } catch (err) {
      console.error('Error saving memo:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Info - Bento Header Card */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2.5">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 text-sm">📝</span>
            <span>{isBn ? 'নতুন বিক্রয় ক্যাশ মেমো তৈরি করুন' : 'Create New Cash Memo'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1.5 font-medium">
            {isBn
              ? 'পণ্যের বিবরণ, দাম ও পরিমাণ লিখুন। অটো ক্যালকুলেশন হবে এবং সাথে সাথে প্রিন্ট করে দিতে পারবেন।'
              : 'Enter items, quantities, and prices. Calculates automatically for print receipts.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={resetForm}
            type="button"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-slate-700/80 transition shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isBn ? 'রিসেট' : 'Reset'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Memo Form (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Memo Details Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <User className="w-4 h-4" />
                </span>
                <span>{isBn ? 'গ্রাহক ও মেমো তথ্য (Customer & Memo Info)' : 'Customer & Memo Details'}</span>
              </h3>

              {/* Previous Customer Quick Select Dropdown */}
              {previousCustomers.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 hidden sm:inline flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isBn ? 'পুরাতন কাস্টমার:' : 'Previous Customer:'}</span>
                  </span>
                  <select
                    onChange={(e) => {
                      const idx = e.target.value;
                      if (idx !== '') {
                        const cust = previousCustomers[Number(idx)];
                        if (cust) selectCustomer(cust);
                      }
                    }}
                    value=""
                    className="text-xs px-3 py-1.5 font-bold border border-emerald-300 rounded-xl bg-emerald-50/70 text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="" disabled>
                      ⚡ {isBn ? `-- কাস্টমার অটো-ফিল (${previousCustomers.length} জন) --` : `-- Select Customer (${previousCustomers.length}) --`}
                    </option>
                    {previousCustomers.map((c, idx) => (
                      <option key={idx} value={idx}>
                        {c.name || 'Unnamed'} {c.phone ? `(${c.phone})` : ''} {c.address ? `- ${c.address}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Customer Name Field */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isBn ? 'গ্রাহকের নাম (Customer Name)' : 'Customer Name'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={isBn ? 'নাম টাইপ করুন' : 'Type customer name'}
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setShowNameSuggestions(true);
                    }}
                    onFocus={() => setShowNameSuggestions(true)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200/90 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium transition"
                  />
                </div>

                {/* Name Auto-suggestions */}
                {showNameSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 max-h-52 overflow-y-auto p-1.5 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase border-b border-slate-100 flex justify-between items-center">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <Users className="w-3 h-3" />
                        {isBn ? 'পুরাতন কাস্টমার তালিকা' : 'Matching Previous Customers'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNameSuggestions(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    {nameSuggestions.map((cust, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectCustomer(cust)}
                        className="w-full text-left p-2 hover:bg-emerald-50 rounded-xl transition flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                            {cust.name}
                          </div>
                          {cust.phone && (
                            <div className="text-[11px] font-mono text-slate-500">{cust.phone}</div>
                          )}
                        </div>
                        {cust.address && (
                          <div className="text-[10px] text-slate-400 max-w-[110px] truncate text-right">
                            {cust.address}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Phone Field */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isBn ? 'মোবাইল নম্বর (Phone)' : 'Mobile Phone'}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="017xxxxxxxx"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      setShowPhoneSuggestions(true);
                    }}
                    onFocus={() => setShowPhoneSuggestions(true)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200/90 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium transition"
                  />
                </div>

                {/* Phone Auto-suggestions */}
                {showPhoneSuggestions && phoneSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 max-h-52 overflow-y-auto p-1.5 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase border-b border-slate-100 flex justify-between items-center">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <Users className="w-3 h-3" />
                        {isBn ? 'ম্যাচিং মোবাইল নম্বর' : 'Matching Phone Numbers'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPhoneSuggestions(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    {phoneSuggestions.map((cust, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectCustomer(cust)}
                        className="w-full text-left p-2 hover:bg-emerald-50 rounded-xl transition flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-mono font-bold text-emerald-700">
                            {cust.phone}
                          </div>
                          <div className="text-[11px] text-slate-700">{cust.name}</div>
                        </div>
                        {cust.address && (
                          <div className="text-[10px] text-slate-400 max-w-[110px] truncate text-right">
                            {cust.address}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isBn ? 'মেমো নম্বর (Memo No)' : 'Memo Number'}
                </label>
                <input
                  type="text"
                  value={memoNo}
                  onChange={(e) => setMemoNo(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-emerald-200 rounded-xl bg-emerald-50/40 text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isBn ? 'তারিখ (Date)' : 'Invoice Date'}
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={memoDate}
                    onChange={(e) => setMemoDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200/90 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium transition"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isBn ? 'ঠিকানা (Address)' : 'Customer Address'}
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={isBn ? 'ঠিকানা (যেমন: ঢাকা)' : 'Address'}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200/90 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Product Items Table Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Package className="w-4 h-4" />
                </span>
                <span>{isBn ? 'পণ্যের তালিকা (Product Item List)' : 'Product Items'}</span>
              </h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                {items.length} {isBn ? 'টি আইটেম' : 'Items'}
              </span>
            </div>

            {/* Item Rows Container */}
            <div className="space-y-3.5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border space-y-2 relative group transition ${
                    item.isGift
                      ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                      : 'bg-slate-50/80 border-slate-200/80 hover:border-emerald-400 hover:shadow-xs'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        #{index + 1}
                      </span>
                      {item.isGift ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-white shadow-2xs">
                          <Gift className="w-3.5 h-3.5" />
                          <span>{isBn ? '🎁 গিফট / ফ্রি আইটেম' : '🎁 Gift / Free Item'}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500">
                          {isBn ? 'সাধারণ বিক্রয় পণ্য' : 'Standard Sale Item'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Gift Toggle Button */}
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, 'isGift', !item.isGift)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border cursor-pointer ${
                          item.isGift
                            ? 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs'
                            : 'bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-slate-200'
                        }`}
                        title={item.isGift ? (isBn ? 'গিফট বাতিল করুন' : 'Remove gift status') : (isBn ? 'গিফট হিসেবে চিহ্নিত করুন' : 'Mark as gift')}
                      >
                        <Gift className={`w-3.5 h-3.5 ${item.isGift ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span>{item.isGift ? (isBn ? '✓ গিফট চিহ্নিত' : '✓ Marked Gift') : (isBn ? '🎁 গিফট হিসেবে দিন' : '🎁 Mark as Gift')}</span>
                      </button>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title={isBn ? 'সারি টি মুছে ফেলুন' : 'Remove Item'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
                    {/* Item Serial & Select or Input Name */}
                    <div className="md:col-span-5 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-extrabold text-slate-700">
                          {isBn ? 'পণ্যের নাম ও বিবরণ' : 'Product Name & Description'}
                        </label>
                        {products.length > 0 && (
                          <span className="text-[10px] text-emerald-600 font-bold">
                            {isBn ? 'তালিকা থেকে পছন্দ করুন:' : 'Select preset:'}
                          </span>
                        )}
                      </div>

                      {products.length > 0 && (
                        <select
                          onChange={(e) => selectProductForItem(item.id, e.target.value)}
                          defaultValue=""
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none mb-1 shadow-2xs"
                        >
                          <option value="" disabled>
                            -- {isBn ? 'মজুদ পণ্য সিলেক্ট করুন' : 'Select Preset Product'} --
                          </option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code ? `[${p.code}] ` : ''}{p.name} ({currency}{p.price}/{p.unit})
                            </option>
                          ))}
                        </select>
                      )}

                      <input
                        type="text"
                        placeholder={item.isGift ? (isBn ? 'উপহার পণ্যের নাম (যেমন: ফ্রি চাবির রিং)' : 'Gift item name') : (isBn ? 'পণ্যের নাম অথবা বিবরণ টাইপ করুন' : 'Type product description')}
                        value={item.name}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        className={`w-full px-3 py-1.5 text-sm font-bold border rounded-xl bg-white text-slate-900 focus:ring-2 outline-none shadow-2xs ${
                          item.isGift ? 'border-amber-300 focus:ring-amber-400' : 'border-slate-200 focus:ring-emerald-500'
                        }`}
                      />

                      {/* Gift Note Input (If Gift) */}
                      {item.isGift && (
                        <div className="pt-1 flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-800 whitespace-nowrap">
                            {isBn ? 'গিফট নোট/অফার:' : 'Gift Note:'}
                          </span>
                          <input
                            type="text"
                            placeholder={isBn ? 'যেমন: বিশেষ উপহার, অফার গিফট' : 'e.g. Special Gift, Free Sample'}
                            value={item.giftNote || ''}
                            onChange={(e) => updateItem(item.id, 'giftNote', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-amber-200 rounded-lg bg-amber-50/50 text-amber-900 focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none font-medium"
                          />
                        </div>
                      )}
                    </div>

                    {/* Unit Price */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {isBn ? 'একক মূল্য (Price)' : 'Unit Price'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">
                          {currency}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unitPrice || ''}
                          onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 text-sm font-mono font-bold border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
                        />
                      </div>
                      {item.isGift && (
                        <span className="text-[10px] font-bold text-amber-700 block mt-0.5">
                          {isBn ? '(মেমোতে ফ্রি হিসেবে থাকবে)' : '(Charged as 0)'}
                        </span>
                      )}
                    </div>

                    {/* Quantity & Unit */}
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {isBn ? 'পরিমাণ ও একক (Qty & Unit)' : 'Qty & Unit'}
                      </label>
                      <div className="flex space-x-1.5">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          className="w-20 px-2 py-1.5 text-sm font-mono font-bold text-center border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
                        />
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                          className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-800 outline-none shadow-2xs"
                        >
                          <option value="পিস">পিস (pc)</option>
                          <option value="কেজি">কেজি (kg)</option>
                          <option value="গ্রাম">গ্রাম (gm)</option>
                          <option value="লিটার">লিটার (ltr)</option>
                          <option value="প্যাকেট">প্যাকেট (pkt)</option>
                          <option value="ডজন">ডজন (doz)</option>
                          <option value="কার্টন">কার্টন (ctn)</option>
                          <option value="বক্স">বক্স (box)</option>
                        </select>
                      </div>
                    </div>

                    {/* Total Price */}
                    <div className="md:col-span-2 flex items-center justify-between gap-2">
                      <div className="text-right flex-1">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          {isBn ? 'মোট (Total)' : 'Total'}
                        </label>
                        {item.isGift ? (
                          <div>
                            <span className="block text-sm font-mono font-extrabold text-amber-700">
                              {currency} 0
                            </span>
                            <span className="inline-block text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              {isBn ? 'ফ্রি / গিফট' : 'FREE'}
                            </span>
                          </div>
                        ) : (
                          <span className="block text-sm font-mono font-extrabold text-emerald-700">
                            {currency} {(item.total || 0).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Item Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={addItemRow}
                className="py-3 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 font-bold text-xs rounded-2xl flex items-center justify-center space-x-2 transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? '+ পণ্য যোগ করুন (Add Product)' : '+ Add Product'}</span>
              </button>

              <button
                type="button"
                onClick={addGiftItemRow}
                className="py-3 border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/60 hover:bg-amber-50 text-amber-800 font-bold text-xs rounded-2xl flex items-center justify-center space-x-2 transition-all shadow-2xs cursor-pointer"
              >
                <Gift className="w-4 h-4 text-amber-600" />
                <span>{isBn ? '+ 🎁 ফ্রি / গিফট আইটেম যোগ করুন' : '+ 🎁 Add Free / Gift Item'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Calculations & Billing Summary Card (1 Col) - Bento Sidebar Card */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-md space-y-4.5 sticky top-24">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                </span>
                <span>{isBn ? 'হিসাব ও বিলিং (Calculation)' : 'Billing Summary'}</span>
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                {isBn ? 'অটো হিসাব' : 'Auto Math'}
              </span>
            </h3>

            {/* Subtotal */}
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-600">
                {isBn ? 'সাবটোটাল (Subtotal):' : 'Subtotal:'}
              </span>
              <span className="font-mono text-base font-extrabold text-slate-900">
                {currency} {subtotal.toLocaleString()}
              </span>
            </div>

            {/* Discount */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">
                  {isBn ? 'ছাড় (Discount):' : 'Discount:'}
                </label>
                <div className="flex border border-slate-200 rounded-xl overflow-hidden text-[11px] font-bold p-0.5 bg-slate-100">
                  <button
                    type="button"
                    onClick={() => setDiscountType('flat')}
                    className={`px-2.5 py-0.5 rounded-lg transition ${
                      discountType === 'flat' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    {currency} Flat
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-2.5 py-0.5 rounded-lg transition ${
                      discountType === 'percent' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="0"
                value={discount || ''}
                onChange={(e) => setDiscount(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
              />
            </div>

            {/* Shipping / Delivery */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-700">
                  {isBn ? 'ডেলিভারি চার্জ (Delivery Charge):' : 'Delivery Charge:'}
                </label>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold border border-emerald-100">
                  {isBn ? 'হোম ডেলিভারি' : 'Home Delivery'}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                  {currency}
                </span>
                <input
                  type="number"
                  min="0"
                  value={shipping || ''}
                  onChange={(e) => setShipping(Number(e.target.value))}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
                />
              </div>

              {/* Quick Preset Buttons for Delivery Fee */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setShipping(0)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                    shipping === 0
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isBn ? 'ফ্রি (৳০)' : 'Free (৳0)'}
                </button>
                <button
                  type="button"
                  onClick={() => setShipping(60)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                    shipping === 60
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isBn ? 'ঢাকা (৳৬০)' : 'Dhaka (৳60)'}
                </button>
                <button
                  type="button"
                  onClick={() => setShipping(120)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                    shipping === 120
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isBn ? 'ঢাকার বাইরে (৳১২০)' : 'Outside Dhaka (৳120)'}
                </button>
              </div>
            </div>

            {/* Grand Total Highlight Box - Bento Dark Box */}
            <div className="bg-slate-900 text-white p-4.5 rounded-2xl shadow-sm space-y-1 border border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {isBn ? 'সর্বমোট প্রদেয় টাকা:' : 'Grand Total:'}
                </span>
                <span className="text-2xl font-mono font-black text-emerald-400">
                  {currency} {totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {isBn ? 'পেমেন্ট মাধ্যম (Payment Method):' : 'Payment Method:'}
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                {(['Cash', 'Bangla QR'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2.5 px-3 rounded-xl border text-center transition-all ${
                      paymentMethod === method
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {method === 'Cash'
                      ? (isBn ? 'ক্যাশ (Cash)' : 'Cash')
                      : (isBn ? 'বাংলা QR (Bangla QR)' : 'Bangla QR')}
                  </button>
                ))}
              </div>
            </div>

            {/* Paid Amount */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">
                  {isBn ? 'জমা/পরিশোধিত টাকা (Paid Amount):' : 'Paid Amount:'}
                </label>
                <button
                  type="button"
                  onClick={handleFullPayment}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-extrabold underline"
                >
                  {isBn ? 'ফুল পে (Full Paid)' : 'Full Paid'}
                </button>
              </div>
              <input
                type="number"
                min="0"
                value={paidAmount || ''}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3.5 py-2.5 text-base font-mono font-extrabold border-2 border-emerald-500 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-emerald-950 bg-emerald-50/20"
              />
            </div>

            {/* Due or Change Display */}
            {dueAmount > 0 ? (
              <div className="bg-rose-50/80 border border-rose-200 p-3.5 rounded-xl flex justify-between items-center text-xs text-rose-950 font-bold">
                <span>{isBn ? 'বকেয়া টাকা (Due Balance):' : 'Due Amount:'}</span>
                <span className="text-base font-mono font-black text-rose-700">
                  {currency} {dueAmount.toLocaleString()}
                </span>
              </div>
            ) : returnChange > 0 ? (
              <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-xl flex justify-between items-center text-xs text-blue-950 font-bold">
                <span>{isBn ? 'ফেরত টাকা (Change Return):' : 'Return Change:'}</span>
                <span className="text-base font-mono font-black text-blue-700">
                  {currency} {returnChange.toLocaleString()}
                </span>
              </div>
            ) : (
              <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl text-center text-xs text-emerald-900 font-extrabold flex items-center justify-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{isBn ? 'সম্পূর্ণ মূল্য পরিশোধিত (Fully Paid)' : 'Fully Paid'}</span>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {isBn ? 'মেমো নোট (Memo Notes):' : 'Memo Note:'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isBn ? 'বিশেষ কোনো দ্রষ্টব্য বা শর্তাবলী...' : 'Optional notes...'}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
              />
            </div>

            {/* Validation Error Banner */}
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleSaveAndAction(true)}
                disabled={isSaving}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
              >
                <Printer className="w-5 h-5" />
                <span>
                  {isSaving
                    ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                    : (isBn ? 'মেমো সেভ ও প্রিন্ট করুন' : 'Save & Print Cash Memo')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAndAction(false)}
                disabled={isSaving}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center justify-center space-x-2 border border-slate-800 transition-all disabled:opacity-50 shadow-xs"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>{isBn ? 'শুধুমাত্র ডাটাবেসে সেভ করুন' : 'Save to Database Only'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
