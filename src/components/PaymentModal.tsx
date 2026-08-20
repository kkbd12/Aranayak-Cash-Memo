import React, { useState } from 'react';
import { CreditCard, Check, X } from 'lucide-react';
import { CashMemo, PaymentMethod, ShopSettings } from '../types';

interface PaymentModalProps {
  memo: CashMemo;
  shopSettings: ShopSettings;
  onSavePayment: (updatedMemo: CashMemo) => Promise<void>;
  onClose: () => void;
  lang: 'bn' | 'en';
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  memo,
  shopSettings,
  onSavePayment,
  onClose,
  lang,
}) => {
  const isBn = lang === 'bn';
  const currency = shopSettings.currencySymbol || '৳';

  const [newPaidAmount, setNewPaidAmount] = useState<number | ''>(memo.dueAmount);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPaidAmount === '' || Number(newPaidAmount) <= 0) return;

    setIsSubmitting(true);
    try {
      const addedPaid = Number(newPaidAmount);
      const totalPaid = memo.paidAmount + addedPaid;
      const updatedDue = Math.max(0, memo.totalAmount - totalPaid);
      const updatedStatus = updatedDue === 0 ? 'Paid' : 'Partial';

      const updatedMemo: CashMemo = {
        ...memo,
        paidAmount: totalPaid,
        dueAmount: updatedDue,
        paymentMethod: method,
        status: updatedStatus,
        notes: memo.notes
          ? `${memo.notes} | [${new Date().toLocaleDateString()}] ${currency}${addedPaid} পরিশোধ (${method})`
          : `[${new Date().toLocaleDateString()}] ${currency}${addedPaid} বকেয়া পরিশোধ করা হলো (${method})`,
      };

      await onSavePayment(updatedMemo);
      onClose();
    } catch (err) {
      console.error('Payment update error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </span>
            <span>{isBn ? 'বকেয়া টাকা আদায় / জমা' : 'Record Due Payment'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Memo Info Card */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
          <div className="flex justify-between font-bold">
            <span className="text-slate-600">{isBn ? 'মেমো নম্বর:' : 'Memo:'}</span>
            <span className="text-emerald-700 font-mono font-black">{memo.memoNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">{isBn ? 'গ্রাহকের নাম:' : 'Customer:'}</span>
            <span className="font-extrabold text-slate-900">{memo.customerName}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200/80 pt-2 mt-1 font-bold">
            <span className="text-slate-700">{isBn ? 'বর্তমান বকেয়া (Due):' : 'Current Due:'}</span>
            <span className="text-rose-600 font-mono font-black text-sm">{currency} {memo.dueAmount.toLocaleString()}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'নতুন জমার পরিমাণ (Amount Paying Now)*' : 'Amount Paying Now*'}
            </label>
            <input
              type="number"
              required
              min="1"
              max={memo.dueAmount}
              value={newPaidAmount}
              onChange={(e) => setNewPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 text-base font-mono font-black border-2 border-emerald-500 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-emerald-900 bg-emerald-50/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isBn ? 'পেমেন্ট মাধ্যম (Payment Method)' : 'Payment Method'}
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              {(['Cash', 'Bangla QR'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2.5 px-3 rounded-xl border text-center transition-all ${
                    method === m
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m === 'Cash'
                    ? (isBn ? 'ক্যাশ (Cash)' : 'Cash')
                    : (isBn ? 'বাংলা QR (Bangla QR)' : 'Bangla QR')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? (isBn ? 'প্রসেস হচ্ছে...' : 'Saving...') : (isBn ? 'জমা নিশ্চিত করুন' : 'Confirm Payment')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
