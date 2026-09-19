import React, { useState, useEffect, useMemo } from 'react';
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
  Layers,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Percent,
  BookmarkPlus,
  X,
} from 'lucide-react';
import { CashMemo, MemoItem, Product, ShopSettings, PaymentMethod, Customer } from '../types';
import { getNextAvailableMemoNumber, isMemoNoDuplicate } from '../utils/memoNumberGenerator';

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

  // Persistent Customer Storage & State
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>(() => {
    try {
      const local = localStorage.getItem('pos_saved_customers_directory');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });

  const [isCustomerDirectoryOpen, setIsCustomerDirectoryOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [customerToast, setCustomerToast] = useState<string | null>(null);

  // New Customer Modal State
  const [modalCustName, setModalCustName] = useState('');
  const [modalCustPhone, setModalCustPhone] = useState('');
  const [modalCustAddress, setModalCustAddress] = useState('');
  const [modalCustNote, setModalCustNote] = useState('');

  // Helper to normalize Bengali & English digits
  const normalizeDigits = (str: string) => {
    const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return (str || '')
      .split('')
      .map((c) => {
        const i = bn.indexOf(c);
        return i !== -1 ? i.toString() : c;
      })
      .join('')
      .replace(/[^0-9]/g, '');
  };

  // Combine customers from saved directory AND from existing memos
  const allCustomers = useMemo(() => {
    const map = new Map<string, { id?: string; name: string; phone: string; address: string; note?: string; totalMemos?: number; totalSpent?: number }>();

    // 1. First add from saved customers
    savedCustomers.forEach((c) => {
      const key = (c.phone ? normalizeDigits(c.phone) : c.name.toLowerCase()).trim();
      if (key) {
        map.set(key, { ...c });
      }
    });

    // 2. Merge from memos
    memos.forEach((m) => {
      const name = (m.customerName || '').trim();
      const phone = (m.customerPhone || '').trim();
      const address = (m.customerAddress || '').trim();

      if ((name && name !== 'খুচরা ক্রেতা' && name !== 'Retail Customer') || phone) {
        const key = (phone ? normalizeDigits(phone) : name.toLowerCase()).trim();
        if (!map.has(key)) {
          map.set(key, {
            id: `memo-cust-${key}`,
            name: name || (isBn ? 'গ্রাহক' : 'Customer'),
            phone: phone,
            address: address,
            totalMemos: 1,
            totalSpent: m.totalAmount || 0,
          });
        } else {
          const ex = map.get(key)!;
          if (!ex.address && address) ex.address = address;
          if (!ex.phone && phone) ex.phone = phone;
          if ((!ex.name || ex.name === 'গ্রাহক' || ex.name === 'Customer') && name) ex.name = name;
          ex.totalMemos = (ex.totalMemos || 0) + 1;
          ex.totalSpent = (ex.totalSpent || 0) + (m.totalAmount || 0);
        }
      }
    });

    return Array.from(map.values());
  }, [savedCustomers, memos, isBn]);

  // Check if current typed input matches an existing customer
  const matchedExistingCustomer = useMemo(() => {
    const normPhone = normalizeDigits(customerPhone);
    const normName = customerName.trim().toLowerCase();

    if (!normPhone && !normName) return null;

    return allCustomers.find((c) => {
      if (normPhone && c.phone && normalizeDigits(c.phone) === normPhone) return true;
      if (normName && c.name.toLowerCase() === normName && (!normPhone || !c.phone)) return true;
      return false;
    });
  }, [customerPhone, customerName, allCustomers]);

  // Direct save/upsert customer to persistent store
  const saveCustomerDirectly = (nameToSave: string, phoneToSave: string, addrToSave: string = '', noteToSave: string = '') => {
    const cName = nameToSave.trim();
    const cPhone = phoneToSave.trim();
    const cAddr = addrToSave.trim();

    if (!cName && !cPhone) {
      alert(isBn ? 'অনুগ্রহ করে গ্রাহকের নাম অথবা মোবাইল নম্বর দিন।' : 'Please enter customer name or phone.');
      return;
    }

    const newCustomer: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cName || (isBn ? 'গ্রাহক' : 'Customer'),
      phone: cPhone,
      address: cAddr,
      note: noteToSave,
      createdAt: new Date().toISOString(),
      totalMemos: 0,
      totalSpent: 0,
    };

    const normP = normalizeDigits(cPhone);
    const updated = [
      newCustomer,
      ...savedCustomers.filter((c) => {
        if (normP && c.phone && normalizeDigits(c.phone) === normP) return false;
        if (cName && c.name.toLowerCase() === cName.toLowerCase() && !normP) return false;
        return true;
      }),
    ];

    setSavedCustomers(updated);
    try {
      localStorage.setItem('pos_saved_customers_directory', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    setCustomerToast(
      isBn
        ? `✓ "${cName || cPhone}" সফলভাবে গ্রাহক তালিকায় সেভ হয়েছে!`
        : `✓ "${cName || cPhone}" saved to customer directory!`
    );
    setTimeout(() => setCustomerToast(null), 3500);
  };

  const deleteSavedCustomer = (targetPhoneOrName: string) => {
    const norm = normalizeDigits(targetPhoneOrName);
    const updated = savedCustomers.filter((c) => {
      if (norm && c.phone && normalizeDigits(c.phone) === norm) return false;
      if (c.name.toLowerCase() === targetPhoneOrName.toLowerCase() && !norm) return false;
      return true;
    });
    setSavedCustomers(updated);
    try {
      localStorage.setItem('pos_saved_customers_directory', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Filter customer suggestions with Bengali & English support
  const nameSuggestions = useMemo(() => {
    if (allCustomers.length === 0) return [];
    const q = customerName.trim().toLowerCase();
    if (!q) {
      // Top recent customers
      return allCustomers.slice(0, 8);
    }
    const qNorm = normalizeDigits(q);
    return allCustomers.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = qNorm && c.phone && normalizeDigits(c.phone).includes(qNorm);
      return matchName || matchPhone;
    });
  }, [customerName, allCustomers]);

  const phoneSuggestions = useMemo(() => {
    if (allCustomers.length === 0) return [];
    const qNorm = normalizeDigits(customerPhone.trim());
    if (!qNorm) {
      return allCustomers.slice(0, 8);
    }
    return allCustomers.filter((c) => {
      const matchPhone = c.phone && normalizeDigits(c.phone).includes(qNorm);
      const matchName = c.name.toLowerCase().includes(customerPhone.trim().toLowerCase());
      return matchPhone || matchName;
    });
  }, [customerPhone, allCustomers]);

  const selectCustomer = (cust: { name: string; phone: string; address?: string }) => {
    setCustomerName(cust.name || '');
    setCustomerPhone(cust.phone || '');
    setCustomerAddress(cust.address || '');
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
    setIsCustomerDirectoryOpen(false);
  };

  // Auto-calculated unique memo number
  const autoMemoInfo = useMemo(() => {
    return getNextAvailableMemoNumber(memos, shopSettings);
  }, [memos, shopSettings]);

  const [isManualMemoNo, setIsManualMemoNo] = useState(false);
  const [memoNo, setMemoNo] = useState('');
  const [memoDate, setMemoDate] = useState(new Date().toISOString().split('T')[0]);
  const [memoTime, setMemoTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  // Keep memoNo synchronized with auto-generated unique number unless user manually edited it
  useEffect(() => {
    if (!isManualMemoNo && autoMemoInfo.memoNo) {
      setMemoNo(autoMemoInfo.memoNo);
    }
  }, [autoMemoInfo.memoNo, isManualMemoNo]);

  // Check if the current memo number is already used in saved memos
  const isDuplicateMemo = useMemo(() => {
    return isMemoNoDuplicate(memoNo, memos);
  }, [memoNo, memos]);

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

  // Select Product or specific Variant from Dropdown
  const handleProductOrVariantSelect = (rowId: string, compoundVal: string) => {
    if (!compoundVal) return;
    const [productId, variantId] = compoundVal.split('::');
    const selected = products.find((p) => p.id === productId);
    if (!selected) return;

    if (variantId && selected.variants) {
      const v = selected.variants.find((item) => item.id === variantId);
      if (v) {
        const baseName = selected.name.replace(/\s*\([^)]*\)\s*$/, '');
        const updatedName = `${baseName} (${v.name})`;
        setItems((prev) =>
          prev.map((item) => {
            if (item.id === rowId) {
              return {
                ...item,
                productId: selected.id,
                selectedVariantId: v.id,
                name: updatedName,
                unitPrice: v.price,
                unit: v.unit || selected.unit,
                total: item.isGift ? 0 : (v.price * item.quantity),
              };
            }
            return item;
          })
        );
        return;
      }
    }

    // Default base product
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === rowId) {
          return {
            ...item,
            productId: selected.id,
            selectedVariantId: undefined,
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

  const selectVariantForItem = (rowId: string, variantId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === rowId && item.productId) {
          const prod = products.find((p) => p.id === item.productId);
          if (!prod) return item;

          if (variantId === 'base') {
            return {
              ...item,
              selectedVariantId: undefined,
              name: prod.name,
              unitPrice: prod.price,
              unit: prod.unit,
              total: item.isGift ? 0 : (prod.price * item.quantity),
            };
          }

          if (prod.variants) {
            const variant = prod.variants.find((v) => v.id === variantId);
            if (variant) {
              const baseName = prod.name.replace(/\s*\([^)]*\)\s*$/, '');
              const updatedName = `${baseName} (${variant.name})`;
              return {
                ...item,
                selectedVariantId: variant.id,
                name: updatedName,
                unitPrice: variant.price,
                unit: variant.unit || prod.unit,
                total: item.isGift ? 0 : (variant.price * item.quantity),
              };
            }
          }
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
    discountType === 'percent'
      ? (subtotal * (Number(discount) || 0)) / 100
      : Number(discount) || 0;

  const discountPercent =
    subtotal > 0
      ? discountType === 'percent'
        ? Number(discount) || 0
        : Number(((discountAmount / subtotal) * 100).toFixed(1))
      : 0;

  const totalAmount = Math.max(0, subtotal - discountAmount + (Number(shipping) || 0));
  
  const dueAmount = Math.max(0, totalAmount - (Number(paidAmount) || 0));
  const returnChange = Math.max(0, (Number(paidAmount) || 0) - totalAmount);

  // Default paid amount to total amount when total amount changes and paid wasn't modified
  const handleFullPayment = () => {
    setPaidAmount(totalAmount);
  };

  const resetForm = (newlySavedMemo?: CashMemo) => {
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
    setIsManualMemoNo(false);
    
    // Calculate the next auto memo number immediately with any newly saved memo included
    const updatedMemos = newlySavedMemo ? [newlySavedMemo, ...memos] : memos;
    const nextAuto = getNextAvailableMemoNumber(updatedMemos, shopSettings);
    setMemoNo(nextAuto.memoNo);
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

      // Ensure unique auto memo number (never save a duplicate)
      let finalMemoNo = memoNo.trim();
      if (!finalMemoNo || isDuplicateMemo) {
        finalMemoNo = autoMemoInfo.memoNo;
      }

      const memoPayload = {
        memoNo: finalMemoNo,
        date: memoDate,
        time: memoTime,
        customerName: customerName.trim() || (isBn ? 'খুচরা ক্রেতা' : 'Retail Customer'),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        items: validItems,
        subtotal,
        discount: discountAmount,
        discountType,
        discountPercent: Number(discountPercent.toFixed(1)),
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
        // Automatically ensure this customer is stored in saved customers directory
        if (customerName.trim() || customerPhone.trim()) {
          saveCustomerDirectly(customerName, customerPhone, customerAddress);
        }

        if (andPrint) {
          onPrintMemo(savedMemo);
        }
        resetForm(savedMemo);
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
            {/* Customer Header with Directory & Add New Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <User className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    {isBn ? 'গ্রাহকের তথ্য (Customer Details)' : 'Customer Details'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {isBn ? 'নাম বা ফোন নম্বর দিলে পূর্বে সেভ করা তথ্য অটো চলে আসবে' : 'Type name or phone for instant suggestions'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Customer Directory Button */}
                <button
                  type="button"
                  onClick={() => setIsCustomerDirectoryOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title={isBn ? 'সব সংরক্ষিত গ্রাহক তালিকা দেখুন ও খুঁজুন' : 'Open saved customer directory'}
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isBn ? `গ্রাহক তালিকা (${allCustomers.length})` : `Customers (${allCustomers.length})`}</span>
                </button>

                {/* Add New Customer Button */}
                <button
                  type="button"
                  onClick={() => {
                    setModalCustName(customerName);
                    setModalCustPhone(customerPhone);
                    setModalCustAddress(customerAddress);
                    setIsNewCustomerModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? '+ নতুন গ্রাহক যোগ' : '+ Add Customer'}</span>
                </button>
              </div>
            </div>

            {/* Quick Customer Picker Dropdown (if any customers exist) */}
            {allCustomers.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1 shrink-0 pl-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isBn ? 'দ্রুত গ্রাহক নির্বাচন:' : 'Quick Select:'}</span>
                </span>
                <select
                  onChange={(e) => {
                    const idx = e.target.value;
                    if (idx !== '') {
                      const cust = allCustomers[Number(idx)];
                      if (cust) selectCustomer(cust);
                    }
                  }}
                  value=""
                  className="w-full text-xs px-3 py-1.5 font-bold border border-emerald-300 rounded-xl bg-white text-emerald-950 focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs cursor-pointer"
                >
                  <option value="" disabled>
                    ⚡ {isBn ? `-- পূর্বের কাস্টমার বাছাই করুন (${allCustomers.length} জন সংরক্ষিত) --` : `-- Pick Saved Customer (${allCustomers.length}) --`}
                  </option>
                  {allCustomers.map((c, idx) => (
                    <option key={idx} value={idx}>
                      {c.name || 'Unnamed'} {c.phone ? `(${c.phone})` : ''} {c.address ? `- ${c.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Customer Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Customer Name Field */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>{isBn ? 'গ্রাহকের নাম (Customer Name)' : 'Customer Name'}</span>
                  {matchedExistingCustomer && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      ✓ {isBn ? 'সংরক্ষিত' : 'Saved'}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={isBn ? 'নাম লিখুন (যেমন: আরিফুল ইসলাম)' : 'Type customer name'}
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
                        {isBn ? 'কাস্টমার তালিকা থেকে সাজেশন' : 'Saved Customer Suggestions'}
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>{isBn ? 'মোবাইল নম্বর (Phone)' : 'Mobile Phone'}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {isBn ? 'বাংলা/ইংরেজি উভয় সাপোর্ট' : 'BN/EN digits'}
                  </span>
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

              {/* Customer Address Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isBn ? 'ঠিকানা (Customer Address)' : 'Customer Address'}
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={isBn ? 'ঠিকানা (যেমন: মিরপুর ১০, ঢাকা)' : 'Address (e.g. Dhaka)'}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200/90 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium transition"
                  />
                </div>
              </div>
            </div>

            {/* Smart Customer Status & Quick Save Prompt */}
            {customerToast ? (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{customerToast}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCustomerToast(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-xs px-1 cursor-pointer font-extrabold"
                >
                  ✕
                </button>
              </div>
            ) : matchedExistingCustomer ? (
              <div className="bg-emerald-50/70 border border-emerald-200/80 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-bold">
                  <span className="p-1 bg-emerald-100 rounded-lg text-emerald-700">
                    <UserCheck className="w-3.5 h-3.5" />
                  </span>
                  <span>
                    {isBn ? '✓ সংরক্ষিত গ্রাহক:' : '✓ Saved Customer:'}{' '}
                    <span className="text-emerald-800 underline">{matchedExistingCustomer.name}</span>
                    {matchedExistingCustomer.phone ? ` (${matchedExistingCustomer.phone})` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  {matchedExistingCustomer.address && (
                    <span className="text-slate-500 hidden sm:inline">{matchedExistingCustomer.address}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => saveCustomerDirectly(customerName, customerPhone, customerAddress)}
                    className="text-emerald-700 hover:text-emerald-900 font-extrabold underline cursor-pointer"
                    title={isBn ? 'নতুন তথ্য দিয়ে আপডেট করুন' : 'Update customer info'}
                  >
                    {isBn ? 'তথ্য আপডেট করুন' : 'Update Info'}
                  </button>
                </div>
              </div>
            ) : (customerName.trim() || customerPhone.trim()) ? (
              <div className="bg-blue-50/90 border border-blue-200 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-blue-950">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-blue-100 rounded-lg text-blue-700">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-bold">
                    {isBn
                      ? 'নতুন গ্রাহক পাওয়া গেছে! ভবিষ্যতে দ্রুত পেতে এই গ্রাহককে সেভ করতে চান?'
                      : 'New customer detected! Would you like to save this customer for future use?'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => saveCustomerDirectly(customerName, customerPhone, customerAddress)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-3 py-1 rounded-lg text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'এই গ্রাহক সেভ করুন' : 'Save This Customer'}</span>
                </button>
              </div>
            ) : null}

            {/* Sub-section: Memo Details (Invoice No, Date, Time) */}
            <div className="border-t border-slate-100 pt-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      {isBn ? 'মেমো নম্বর (Memo No)' : 'Memo Number'}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {isDuplicateMemo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-100 text-rose-700">
                          <AlertCircle className="w-3 h-3" />
                          {isBn ? 'ডুপ্লিকেট' : 'Duplicate'}
                        </span>
                      ) : isManualMemoNo ? (
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-700">
                          {isBn ? 'কাস্টম' : 'Custom'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-700">
                          <Sparkles className="w-3 h-3" />
                          {isBn ? 'অটো' : 'Auto'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualMemoNo(false);
                          setMemoNo(autoMemoInfo.memoNo);
                        }}
                        title={isBn ? 'স্বয়ংক্রিয় পরবর্তী ইউনিক নম্বর সেট করুন' : 'Reset to next auto number'}
                        className="text-xs text-emerald-700 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={memoNo}
                      onChange={(e) => {
                        setIsManualMemoNo(true);
                        setMemoNo(e.target.value);
                      }}
                      placeholder={autoMemoInfo.memoNo}
                      className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-xl outline-none transition ${
                        isDuplicateMemo
                          ? 'border-2 border-rose-300 bg-rose-50/50 text-rose-800 focus:ring-2 focus:ring-rose-500'
                          : 'border border-emerald-200 bg-emerald-50/40 text-emerald-800 focus:ring-2 focus:ring-emerald-500'
                      }`}
                    />
                  </div>
                  {isDuplicateMemo && (
                    <div className="mt-1 flex items-center justify-between text-xs text-rose-600 font-medium">
                      <span>{isBn ? 'এই নম্বরটি আগে ব্যবহৃত হয়েছে!' : 'Already exists!'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualMemoNo(false);
                          setMemoNo(autoMemoInfo.memoNo);
                        }}
                        className="font-bold underline text-emerald-700 hover:text-emerald-800 ml-1 cursor-pointer"
                      >
                        {isBn ? `অটো ${autoMemoInfo.memoNo} বসান` : `Use ${autoMemoInfo.memoNo}`}
                      </button>
                    </div>
                  )}
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {isBn ? 'সময় (Time)' : 'Time'}
                  </label>
                  <input
                    type="time"
                    value={memoTime}
                    onChange={(e) => setMemoTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200/90 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium transition"
                  />
                </div>
              </div>
            </div>
          </div>

            {/* Product Items Table Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Package className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  {isBn ? 'পণ্যের তালিকা (Product Item List)' : 'Product Items'}
                </h3>
              </div>
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
                          onChange={(e) => handleProductOrVariantSelect(item.id, e.target.value)}
                          value={
                            item.productId
                              ? item.selectedVariantId
                                ? `${item.productId}::${item.selectedVariantId}`
                                : `${item.productId}`
                              : ''
                          }
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none mb-1 shadow-2xs"
                        >
                          <option value="" disabled>
                            -- {isBn ? 'মজুদ পণ্য ও সাইজ সিলেক্ট করুন' : 'Select Product & Size/Variant'} --
                          </option>
                          {products.map((p) => {
                            const hasVariants = p.variants && p.variants.length > 0;
                            if (!hasVariants) {
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.code ? `[${p.code}] ` : ''}{p.name} ({currency}{p.price}/{p.unit})
                                </option>
                              );
                            }
                            return (
                              <optgroup key={p.id} label={`📦 ${p.code ? `[${p.code}] ` : ''}${p.name}`}>
                                <option value={p.id}>
                                  ↳ {p.name} (মূল: {currency}{p.price}/{p.unit})
                                </option>
                                {p.variants?.map((v) => (
                                  <option key={v.id} value={`${p.id}::${v.id}`}>
                                    ↳ {p.name} - {v.name} ➔ {currency}{v.price} ({v.unit || p.unit})
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      )}

                      {/* Variant Selection Chips if selected product has variants */}
                      {(() => {
                        if (!item.productId) return null;
                        const curProd = products.find((p) => p.id === item.productId);
                        if (!curProd || !curProd.variants || curProd.variants.length === 0) return null;

                        return (
                          <div className="mb-1 p-2 bg-emerald-50/70 rounded-xl border border-emerald-200/80 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-emerald-950 flex items-center gap-1">
                                <Layers className="w-3 h-3 text-emerald-600" />
                                {isBn ? 'সাইজ / ওজন দ্রুত পরিবর্তন:' : 'Change Size/Weight Variant:'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => selectVariantForItem(item.id, 'base')}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition border cursor-pointer ${
                                  !item.selectedVariantId
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-100/60'
                                }`}
                              >
                                {isBn ? 'মূল' : 'Base'} ({currency}{curProd.price}/{curProd.unit})
                              </button>
                              {curProd.variants.map((v) => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => selectVariantForItem(item.id, v.id)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition border cursor-pointer ${
                                    item.selectedVariantId === v.id
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-100/60'
                                  }`}
                                >
                                  {v.name} ({currency}{v.price})
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

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
                          <option value="জার">জার (Jar)</option>
                          <option value="বোতল">বোতল (btl)</option>
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

            {/* Discount with Live % Indicator */}
            <div className="space-y-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    {isBn ? 'ছাড় / ডিসকাউন্ট (Discount):' : 'Discount:'}
                  </label>
                  {discountAmount > 0 && (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {discountPercent.toFixed(1)}% {isBn ? 'ছাড়' : 'OFF'}
                    </span>
                  )}
                </div>
                <div className="flex border border-slate-200 rounded-xl overflow-hidden text-[11px] font-bold p-0.5 bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setDiscountType('flat')}
                    className={`px-2.5 py-0.5 rounded-lg transition cursor-pointer ${
                      discountType === 'flat' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {currency} Flat
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-2.5 py-0.5 rounded-lg transition cursor-pointer ${
                      discountType === 'percent' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder={discountType === 'percent' ? "e.g. 10%" : "e.g. 50"}
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                />
                {discountType === 'percent' && (
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                    %
                  </span>
                )}
              </div>

              {/* Live Discount Percentage & Amount Feedback Banner */}
              {discountAmount > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2 rounded-xl text-xs font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{isBn ? 'মোট ছাড়ের হার:' : 'Total Discount Rate:'}</span>
                    <span className="text-emerald-700 font-extrabold underline font-mono text-sm">
                      {discountPercent.toFixed(1)}%
                    </span>
                  </span>
                  <span className="text-emerald-800 font-mono font-black">
                    - {currency} {discountAmount.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Quick Discount Presets */}
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="text-[10px] text-slate-400 font-bold mr-0.5">
                  {isBn ? 'কুইক ছাড়:' : 'Presets:'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('percent');
                    setDiscount(0);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                    discount === 0 ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isBn ? '০% (নাই)' : '0%'}
                </button>
                {[5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setDiscountType('percent');
                      setDiscount(pct);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      discountType === 'percent' && discount === pct
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
                {[50, 100].map((flatVal) => (
                  <button
                    key={`flat-${flatVal}`}
                    type="button"
                    onClick={() => {
                      setDiscountType('flat');
                      setDiscount(flatVal);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      discountType === 'flat' && discount === flatVal
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ৳{flatVal}
                  </button>
                ))}
              </div>
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

            {/* Calculation summary line items */}
            {(discountAmount > 0 || Number(shipping) > 0) && (
              <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 text-xs space-y-1 font-medium">
                <div className="flex justify-between text-slate-600">
                  <span>{isBn ? 'সাবটোটাল:' : 'Subtotal:'}</span>
                  <span className="font-mono font-bold">{currency} {subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span className="flex items-center gap-1">
                      <span>{isBn ? 'ছাড় (' : 'Discount ('}</span>
                      <span className="underline font-mono">{discountPercent.toFixed(1)}%</span>
                      <span>):</span>
                    </span>
                    <span className="font-mono">- {currency} {discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {Number(shipping) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>{isBn ? 'ডেলিভারি চার্জ:' : 'Delivery Fee:'}</span>
                    <span className="font-mono font-bold">+ {currency} {Number(shipping).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

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
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>
                  {isSaving
                    ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                    : (isBn ? 'মেমো সেভ ও প্রিন্ট / ডাউনলোড করুন' : 'Save, Print & Download Memo')}
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

      {/* Customer Directory Modal */}
      {isCustomerDirectoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    {isBn ? 'সংরক্ষিত গ্রাহক ডিরেক্টরি' : 'Customer Directory'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {isBn
                      ? `মোট ${allCustomers.length} জন গ্রাহক সংরক্ষিত আছেন`
                      : `Total ${allCustomers.length} customers registered`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalCustName('');
                    setModalCustPhone('');
                    setModalCustAddress('');
                    setIsNewCustomerModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1 shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isBn ? '+ নতুন গ্রাহক' : '+ New Customer'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomerDirectoryOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder={isBn ? 'নাম, ফোন নম্বর বা ঠিকানা দিয়ে খুঁজুন...' : 'Search by name, phone or address...'}
                  value={directorySearchQuery}
                  onChange={(e) => setDirectorySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
                {directorySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDirectorySearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Customers List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {(() => {
                const q = directorySearchQuery.trim().toLowerCase();
                const normQ = normalizeDigits(q);
                const filtered = allCustomers.filter((c) => {
                  if (!q) return true;
                  if (c.name.toLowerCase().includes(q)) return true;
                  if (c.phone && normalizeDigits(c.phone).includes(normQ)) return true;
                  if (c.address && c.address.toLowerCase().includes(q)) return true;
                  return false;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 space-y-3">
                      <Users className="w-10 h-10 mx-auto text-slate-300 opacity-60" />
                      <p className="text-sm font-bold text-slate-500">
                        {isBn ? 'কোনো গ্রাহক পাওয়া যায়নি' : 'No customers found'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setModalCustName(directorySearchQuery);
                          setIsNewCustomerModalOpen(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 transition cursor-pointer"
                      >
                        {isBn ? `"${directorySearchQuery}" নামে নতুন গ্রাহক যোগ করুন` : 'Add as new customer'}
                      </button>
                    </div>
                  );
                }

                return filtered.map((cust, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-slate-200/90 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition flex flex-wrap items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-800 font-bold flex items-center justify-center text-sm uppercase shrink-0">
                        {cust.name ? cust.name.slice(0, 2) : 'GR'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900">{cust.name}</span>
                          {cust.totalMemos && cust.totalMemos > 1 && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                              {cust.totalMemos} {isBn ? 'বার ক্রয়' : 'orders'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 mt-0.5">
                          {cust.phone && (
                            <span className="font-mono font-bold text-emerald-700 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              {cust.phone}
                            </span>
                          )}
                          {cust.address && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {cust.address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          selectCustomer(cust);
                          setIsCustomerDirectoryOpen(false);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isBn ? 'মেমোতে বসান' : 'Use in Memo'}</span>
                      </button>

                      {/* Option to remove from saved list */}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(isBn ? `আপনি কি "${cust.name}" কে সংরক্ষিত তালিকা থেকে মুছে ফেলতে চান?` : `Delete "${cust.name}" from saved list?`)) {
                            deleteSavedCustomer(cust.phone || cust.name);
                          }
                        }}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title={isBn ? 'তালিকা থেকে মুছে ফেলুন' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <BookmarkPlus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    {isBn ? 'নতুন গ্রাহক যোগ করুন' : 'Add New Customer'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isBn ? 'একবার সেভ করলে ভবিষ্যতে অটো সাজেশন আসবে' : 'Saved customer will appear in instant search'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'গ্রাহকের নাম (Customer Name) *' : 'Customer Name *'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={modalCustName}
                    onChange={(e) => setModalCustName(e.target.value)}
                    placeholder={isBn ? 'যেমন: আরিফ মাহমুদ' : 'e.g. Arif Mahmud'}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{isBn ? 'মোবাইল নম্বর (Phone Number) *' : 'Phone Number *'}</span>
                  <span className="text-[10px] text-slate-400">
                    {isBn ? 'বাংলা/ইংরেজি উভয় গ্রহণযোগ্য' : 'BN/EN digits allowed'}
                  </span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={modalCustPhone}
                    onChange={(e) => setModalCustPhone(e.target.value)}
                    placeholder="01712345678"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'ঠিকানা (Address)' : 'Address'}
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={modalCustAddress}
                    onChange={(e) => setModalCustAddress(e.target.value)}
                    placeholder={isBn ? 'যেমন: মিরপুর ১০, ঢাকা' : 'e.g. Mirpur, Dhaka'}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'বিশেষ নোট বা মন্তব্য (ঐচ্ছিক)' : 'Notes (Optional)'}
                </label>
                <input
                  type="text"
                  value={modalCustNote}
                  onChange={(e) => setModalCustNote(e.target.value)}
                  placeholder={isBn ? 'যেমন: বিশ্বস্ত নিয়মিত ক্রেতা' : 'e.g. VIP Customer'}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!modalCustName.trim() && !modalCustPhone.trim()) {
                    alert(isBn ? 'অনুগ্রহ করে নাম অথবা ফোন নম্বর প্রদান করুন।' : 'Please enter customer name or phone.');
                    return;
                  }
                  saveCustomerDirectly(modalCustName, modalCustPhone, modalCustAddress, modalCustNote);
                  // Also populate into the current memo
                  setCustomerName(modalCustName.trim());
                  setCustomerPhone(modalCustPhone.trim());
                  setCustomerAddress(modalCustAddress.trim());
                  setIsNewCustomerModalOpen(false);
                }}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isBn ? 'সেভ করুন ও মেমোতে বসান' : 'Save & Use in Memo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
