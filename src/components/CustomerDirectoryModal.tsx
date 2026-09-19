import React, { useState, useMemo } from 'react';
import {
  Users,
  X,
  Search,
  Plus,
  Phone,
  MapPin,
  FileText,
  Trash2,
  Edit2,
  Check,
  UserCheck,
  Clock,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { Customer } from '../types';

interface CustomerDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onAddCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer | void>;
  onUpdateCustomer?: (customer: Customer) => Promise<void>;
  onDeleteCustomer?: (customerId: string) => Promise<void>;
  onSelectCustomerForMemo?: (customer: Customer) => void;
  currency: string;
  lang: 'bn' | 'en';
}

export const CustomerDirectoryModal: React.FC<CustomerDirectoryModalProps> = ({
  isOpen,
  onClose,
  customers,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onSelectCustomerForMemo,
  currency,
  lang,
}) => {
  const isBn = lang === 'bn';
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setNote('');
    setFormError(null);
    setIsAddingNew(false);
    setEditingId(null);
  };

  const handleStartEdit = (c: Customer) => {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setAddress(c.address || '');
    setNote(c.note || '');
    setIsAddingNew(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError(isBn ? 'ক্রেতার নাম আবশ্যক!' : 'Customer name is required!');
      return;
    }
    if (!phone.trim()) {
      setFormError(isBn ? 'মোবাইল নম্বর আবশ্যক!' : 'Phone number is required!');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (editingId && onUpdateCustomer) {
        const existing = customers.find((c) => c.id === editingId);
        if (existing) {
          await onUpdateCustomer({
            ...existing,
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim() || undefined,
            note: note.trim() || undefined,
          });
        }
      } else {
        await onAddCustomer({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || undefined,
          note: note.trim() || undefined,
          totalMemos: 0,
          totalSpent: 0,
        });
      }

      resetForm();
    } catch (err: any) {
      console.error('Error saving customer:', err);
      setFormError(isBn ? 'কাস্টমার সংরক্ষণ করতে সমস্যা হয়েছে।' : 'Failed to save customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 my-8 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {isBn ? 'কাস্টমার খাতা ও ডিরেক্টরি' : 'Customer Phonebook & Directory'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isBn
                  ? `মোট সংরক্ষিত কাস্টমার: ${customers.length} জন`
                  : `Total saved customers: ${customers.length}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={isBn ? 'নাম বা মোবাইল নম্বর দিয়ে খুঁজুন...' : 'Search by name or phone...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-bold border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsAddingNew(!isAddingNew);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
              isAddingNew
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
            }`}
          >
            {isAddingNew ? (
              <span>{isBn ? 'তালিকা দেখুন' : 'View List'}</span>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>{isBn ? '+ নতুন কাস্টমার যোগ' : '+ Add New Customer'}</span>
              </>
            )}
          </button>
        </div>

        {/* Add/Edit Form */}
        {isAddingNew && (
          <form
            onSubmit={handleSubmit}
            className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4.5 space-y-3.5 transition-all"
          >
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                {editingId
                  ? isBn ? 'কাস্টমার তথ্য সংশোধন করুন' : 'Edit Customer Information'
                  : isBn ? 'নতুন কাস্টমার নিবন্ধন করুন' : 'Register New Customer'}
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-bold"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
            </div>

            {formError && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? 'কাস্টমারের নাম*' : 'Customer Name*'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মোঃ রফিকুল ইসলাম"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? 'মোবাইল নম্বর*' : 'Phone Number*'}
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    placeholder="017XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? 'ঠিকানা (ঐচ্ছিক)' : 'Address (Optional)'}
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="যেমন: মিরপুর ১০, ঢাকা"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? 'বিশেষ নোট (ঐচ্ছিক)' : 'Note (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder="যেমন: নিয়মিত গ্রাহক / পাইকারি"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {editingId
                    ? isBn ? 'আপডেট করুন' : 'Update Customer'
                    : isBn ? 'কাস্টমার সেভ করুন' : 'Save Customer'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Customer List Table / Cards */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">
                {searchQuery
                  ? isBn ? 'কোন কাস্টমার পাওয়া যায়নি!' : 'No matching customers found!'
                  : isBn ? 'এখনো কোন কাস্টমার যুক্ত করা হয়নি।' : 'No customers saved yet.'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {isBn
                  ? 'উপরে "+ নতুন কাস্টমার যোগ" বোতামে ক্লিক করে নতুন কাস্টমার সংরক্ষণ করুন অথবা মেমো তৈরির সময় স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।'
                  : 'Click "+ Add New Customer" above to add customers, or they will be auto-saved upon memo creation.'}
              </p>
              {!isAddingNew && (
                <button
                  type="button"
                  onClick={() => setIsAddingNew(true)}
                  className="mt-3.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 transition shadow-2xs"
                >
                  {isBn ? '+ প্রথম কাস্টমার যোগ করুন' : '+ Add First Customer'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200/90 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{c.name}</span>
                      {c.note && (
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.2 rounded-md">
                          {c.note}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
                      <span className="flex items-center gap-1 font-mono font-bold text-slate-700">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        {c.phone}
                      </span>
                      {c.address && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {c.address}
                        </span>
                      )}
                    </div>

                    {(c.totalMemos !== undefined && c.totalMemos > 0) && (
                      <div className="text-[11px] text-slate-500 pt-0.5 flex items-center gap-3">
                        <span className="text-emerald-700 font-bold">
                          {isBn ? `মোট মেমো: ${c.totalMemos} টি` : `Memos: ${c.totalMemos}`}
                        </span>
                        {c.totalSpent !== undefined && c.totalSpent > 0 && (
                          <span className="font-mono text-slate-700 font-bold">
                            {isBn ? `মোট ক্রয়: ${currency} ${c.totalSpent.toLocaleString()}` : `Total Spent: ${currency} ${c.totalSpent.toLocaleString()}`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {onSelectCustomerForMemo && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCustomerForMemo(c);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title={isBn ? 'এই কাস্টমারের নামে মেমো তৈরি করুন' : 'Create memo for this customer'}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isBn ? 'মেমো বানান' : 'Create Memo'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStartEdit(c)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                      title={isBn ? 'এডিট করুন' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {onDeleteCustomer && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              isBn
                                ? `আপনি কি নিশ্চিত যে "${c.name}" কে কাস্টমার তালিকা থেকে মুছতে চান?`
                                : `Are you sure you want to delete ${c.name}?`
                            )
                          ) {
                            onDeleteCustomer(c.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>{isBn ? '💡 ক্যাশ মেমো তৈরির সময় স্বয়ংক্রিয়ভাবে নতুন কাস্টমার তালিকায় যুক্ত হয়।' : '💡 New customers are also auto-saved when generating cash memos.'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
