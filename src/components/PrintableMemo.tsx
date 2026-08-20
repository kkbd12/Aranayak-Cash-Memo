import React, { useState } from 'react';
import { CashMemo, ShopSettings } from '../types';
import { numberToBnWords, formatCurrency } from '../utils/numberToWords';
import { Printer, CheckCircle, Clock, AlertCircle, FileDown, Loader2, ExternalLink } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PrintableMemoProps {
  memo: CashMemo;
  shopSettings: ShopSettings;
  lang: 'bn' | 'en';
  onClose?: () => void;
  showActions?: boolean;
}

export const PrintableMemo: React.FC<PrintableMemoProps> = ({
  memo,
  shopSettings,
  lang,
  onClose,
  showActions = true,
}) => {
  const isBn = lang === 'bn';
  const currency = shopSettings.currencySymbol || '৳';
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrint = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error('Window print failed:', e);
    }
  };

  const handleOpenPrintWindow = () => {
    const elem = document.getElementById('printable-area');
    if (!elem) return;

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Memo_${memo.memoNo}</title>
            <meta charset="utf-8" />
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: A5 portrait; margin: 8mm; }
              body { font-family: system-ui, -apple-system, sans-serif; background: #ffffff; color: #0f172a; padding: 10px; }
            </style>
          </head>
          <body>
            <div>${elem.innerHTML}</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 400);
              }
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    } else {
      handlePrint();
    }
  };

  const handleDownloadA5PDF = async () => {
    const element = document.getElementById('printable-area');
    if (!element) return;

    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // 1. Sanitize all <style> tags in cloned document to remove oklch(...) functions that crash html2canvas
          const styleEls = clonedDoc.querySelectorAll('style');
          styleEls.forEach((style) => {
            if (style.textContent && style.textContent.includes('oklch')) {
              style.textContent = style.textContent.replace(/oklch\([^)]+\)/g, 'rgb(0, 0, 0)');
            }
          });

          // 2. Transfer computed RGB colors from live DOM elements to cloned elements
          const origArea = document.getElementById('printable-area');
          const clonedArea = clonedDoc.getElementById('printable-area');

          if (origArea && clonedArea) {
            const origElements = [origArea, ...Array.from(origArea.querySelectorAll('*'))];
            const clonedElements = [clonedArea, ...Array.from(clonedArea.querySelectorAll('*'))];

            for (let i = 0; i < origElements.length; i++) {
              const origEl = origElements[i] as HTMLElement;
              const clonedEl = clonedElements[i] as HTMLElement;

              if (origEl && clonedEl && origEl.nodeType === Node.ELEMENT_NODE) {
                const computed = window.getComputedStyle(origEl);
                if (computed.color) clonedEl.style.color = computed.color;
                if (computed.backgroundColor) clonedEl.style.backgroundColor = computed.backgroundColor;
                if (computed.borderColor) clonedEl.style.borderColor = computed.borderColor;
              }
            }
          }
        },
      });

      const imgData = canvas.toDataURL('image/png');

      // Create A5 document: 148mm x 210mm
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5',
      });

      const pdfWidth = 148;
      const pdfHeight = 210;
      const margin = 6;

      const printWidth = pdfWidth - margin * 2; // 136mm
      const printHeight = (canvas.height * printWidth) / canvas.width;

      let yPos = margin;
      if (printHeight < pdfHeight - margin * 2) {
        yPos = margin + (pdfHeight - margin * 2 - printHeight) / 4;
      }

      pdf.addImage(imgData, 'PNG', margin, yPos, printWidth, printHeight);
      pdf.save(`CashMemo_${memo.memoNo}_A5.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert(
        isBn
          ? 'পিডিএফ ডাউনলোড করতে সমস্যা হয়েছে! দয়া করে আবার চেষ্টা করুন।'
          : 'Failed to generate PDF. Please try again.'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="printable-memo-wrapper">
      {/* Action Buttons Header (Screen only) */}
      {showActions && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 bg-slate-800 text-white p-3.5 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {memo.memoNo}
            </span>
            <span className="text-xs sm:text-sm text-slate-300 font-bold">
              {isBn ? 'ক্যাশ মেমো (A5 সাইজ প্রিভিউ)' : 'Cash Memo (A5 Size Preview)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Download A5 PDF Button */}
            <button
              type="button"
              onClick={handleDownloadA5PDF}
              disabled={isGeneratingPdf}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow transition cursor-pointer"
              title={isBn ? 'A5 সাইজে PDF হিসেবে সেভ করুন' : 'Save as A5 PDF'}
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>{isBn ? 'PDF তৈরি হচ্ছে...' : 'Generating PDF...'}</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>{isBn ? 'A5 PDF সেভ করুন' : 'Save A5 PDF'}</span>
                </>
              )}
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isBn ? 'প্রিন্ট (Print)' : 'Print'}</span>
            </button>

            {/* Fallback New Window Print Button */}
            <button
              type="button"
              onClick={handleOpenPrintWindow}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 p-2 rounded-xl text-xs font-medium transition cursor-pointer"
              title={isBn ? 'নতুন ট্যাবে খুলুন ও প্রিন্ট করুন' : 'Open in new tab to print'}
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cash Memo Sheet Container */}
      <div
        id="printable-area"
        className="printable-memo-content bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-lg border border-slate-200 max-w-3xl mx-auto font-sans leading-relaxed text-sm print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full"
      >
        {/* Memo Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
          {shopSettings.logoUrl && (
            <div className="flex justify-center mb-2">
              <img
                src={shopSettings.logoUrl}
                alt={shopSettings.shopName}
                className="h-14 max-w-[180px] object-contain"
              />
            </div>
          )}
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wide text-slate-900 uppercase">
            {shopSettings.shopName || 'বিসমিল্লাহ জেনারেল স্টোর'}
          </h2>
          {shopSettings.proprietorName && (
            <p className="text-xs sm:text-sm text-slate-700 font-medium mt-0.5">
              PROPRIETOR: {shopSettings.proprietorName}
            </p>
          )}
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {shopSettings.address}
          </p>
          <div className="flex justify-center items-center gap-4 text-xs font-semibold text-slate-800 mt-1">
            <span>মোবাইল: {shopSettings.phone}</span>
            {shopSettings.altPhone && <span>, {shopSettings.altPhone}</span>}
          </div>

          {/* CASH MEMO Title Badge */}
          <div className="mt-3 inline-block bg-slate-900 text-white font-bold text-sm sm:text-base px-6 py-1 rounded-full uppercase tracking-wider">
            {isBn ? 'ক্যাশ মেমো' : 'CASH MEMO'}
          </div>
        </div>

        {/* Memo Meta Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-5 text-xs sm:text-sm bg-slate-50 p-3.5 rounded-lg border border-slate-200">
          <div>
            <div className="flex items-center space-x-1 mb-1">
              <span className="font-bold text-slate-700">{isBn ? 'গ্রাহকের নাম:' : 'Customer Name:'}</span>
              <span className="font-semibold text-slate-900">{memo.customerName || (isBn ? 'খুচরা ক্রেতা' : 'Retail Customer')}</span>
            </div>
            <div className="flex items-center space-x-1 mb-1">
              <span className="font-bold text-slate-700">{isBn ? 'মোবাইল নং:' : 'Phone No:'}</span>
              <span>{memo.customerPhone || 'N/A'}</span>
            </div>
            {memo.customerAddress && (
              <div className="flex items-start space-x-1">
                <span className="font-bold text-slate-700">{isBn ? 'ঠিকানা:' : 'Address:'}</span>
                <span>{memo.customerAddress}</span>
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="flex justify-end items-center space-x-1 mb-1">
              <span className="font-bold text-slate-700">{isBn ? 'মেমো নম্বর:' : 'Memo No:'}</span>
              <span className="font-bold text-emerald-700">{memo.memoNo}</span>
            </div>
            <div className="flex justify-end items-center space-x-1 mb-1">
              <span className="font-bold text-slate-700">{isBn ? 'তারিখ:' : 'Date:'}</span>
              <span>{memo.date} {memo.time && `(${memo.time})`}</span>
            </div>
            <div className="flex justify-end items-center space-x-1">
              <span className="font-bold text-slate-700">{isBn ? 'পেমেন্ট মাধ্যম:' : 'Payment Mode:'}</span>
              <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-xs font-semibold">
                {memo.paymentMethod}
              </span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse border border-slate-300 text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-800 text-white text-center font-bold">
                <th className="border border-slate-300 px-2.5 py-2 w-12">{isBn ? 'ক্রম' : 'SL'}</th>
                <th className="border border-slate-300 px-3 py-2 text-left">{isBn ? 'পণ্যের বিবরণ' : 'Item Description'}</th>
                <th className="border border-slate-300 px-3 py-2 w-24 text-right">{isBn ? 'একক মূল্য' : 'Unit Price'}</th>
                <th className="border border-slate-300 px-3 py-2 w-20 text-center">{isBn ? 'পরিমাণ' : 'Qty'}</th>
                <th className="border border-slate-300 px-3 py-2 w-28 text-right">{isBn ? 'মোট টাকা' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {memo.items.map((item, index) => (
                <tr
                  key={item.id || index}
                  className={
                    item.isGift
                      ? 'bg-amber-50/70 font-medium'
                      : index % 2 === 0
                      ? 'bg-white'
                      : 'bg-slate-50/60'
                  }
                >
                  <td className="border border-slate-300 px-2.5 py-2 text-center font-medium text-slate-600">
                    {index + 1}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 font-medium text-slate-900">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{item.name}</span>
                      {item.isGift && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-400 print:bg-slate-200 print:text-slate-900 print:border-slate-400">
                          🎁 {item.giftNote || (isBn ? 'ফ্রি / গিফট' : 'Gift / Free')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-mono text-slate-700">
                    {item.isGift ? (
                      <div>
                        {item.unitPrice > 0 && (
                          <span className="line-through text-slate-400 text-[11px] mr-1 block sm:inline">
                            {currency} {item.unitPrice.toLocaleString()}
                          </span>
                        )}
                        <span className="font-bold text-amber-700 text-xs">
                          {isBn ? 'ফ্রি' : 'Free'}
                        </span>
                      </div>
                    ) : (
                      <span>
                        {currency} {item.unitPrice.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-mono font-medium text-slate-800">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-mono font-bold text-slate-900">
                    {item.isGift ? (
                      <div>
                        <span className="text-amber-700 font-extrabold">{currency} 0</span>
                        <span className="block text-[10px] font-bold text-amber-800">({isBn ? 'ফ্রি' : 'Gift'})</span>
                      </div>
                    ) : (
                      <span>
                        {currency} {item.total.toLocaleString()}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Amount Breakdown & Summary Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start mb-6">
          {/* Notes & Words */}
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-1">{isBn ? 'কথায় (In Words):' : 'In Words:'}</span>
              <span className="italic font-medium text-slate-900">
                {numberToBnWords(memo.totalAmount)}
              </span>
            </div>

            {memo.notes && (
              <div className="bg-amber-50/70 text-amber-900 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="font-bold">{isBn ? 'বিশেষ নোট:' : 'Note:'} </span>
                <span>{memo.notes}</span>
              </div>
            )}

            {/* Status Badge */}
            <div className="flex items-center space-x-2 pt-1">
              <span className="text-xs font-bold text-slate-600">{isBn ? 'পেমেন্ট স্ট্যাটাস:' : 'Payment Status:'}</span>
              {memo.status === 'Paid' ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{isBn ? 'পরিশোধিত (Paid)' : 'Paid'}</span>
                </span>
              ) : memo.status === 'Partial' ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isBn ? 'আংশিক বকেয়া (Partial)' : 'Partial Due'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{isBn ? 'বকেয়া (Unpaid)' : 'Unpaid'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Total Calculation Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden text-xs sm:text-sm">
            <div className="flex justify-between px-3.5 py-2 border-b border-slate-200">
              <span className="text-slate-600">{isBn ? 'সাবটোটাল (Subtotal):' : 'Subtotal:'}</span>
              <span className="font-mono font-semibold">{currency} {memo.subtotal.toLocaleString()}</span>
            </div>

            {memo.discount > 0 && (
              <div className="flex justify-between px-3.5 py-2 border-b border-slate-200 text-rose-600">
                <span>
                  {isBn ? 'ছাড় (Discount):' : 'Discount:'}{' '}
                  {memo.discountType === 'percent' && `(${memo.discount}%)`}
                </span>
                <span className="font-mono font-semibold">
                  - {currency} {memo.discount.toLocaleString()}
                </span>
              </div>
            )}

            {memo.shipping > 0 && (
              <div className="flex justify-between px-3.5 py-2 border-b border-slate-200">
                <span className="text-slate-600">{isBn ? 'ডেলিভারি চার্জ:' : 'Shipping:'}</span>
                <span className="font-mono font-semibold">+ {currency} {memo.shipping.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between px-3.5 py-2 bg-slate-900 text-white font-bold text-sm sm:text-base">
              <span>{isBn ? 'সর্বমোট টাকা (Grand Total):' : 'Grand Total:'}</span>
              <span className="font-mono text-emerald-400">{currency} {memo.totalAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between px-3.5 py-2 border-b border-slate-200 bg-emerald-50 text-emerald-900 font-semibold">
              <span>{isBn ? 'জমা/জমা দেওয়া টাকা (Paid):' : 'Paid Amount:'}</span>
              <span className="font-mono font-bold text-emerald-700">{currency} {memo.paidAmount.toLocaleString()}</span>
            </div>

            {memo.dueAmount > 0 ? (
              <div className="flex justify-between px-3.5 py-2 bg-rose-50 text-rose-900 font-bold">
                <span>{isBn ? 'বকেয়া টাকা (Due Amount):' : 'Due Balance:'}</span>
                <span className="font-mono font-bold text-rose-700">{currency} {memo.dueAmount.toLocaleString()}</span>
              </div>
            ) : memo.paidAmount > memo.totalAmount ? (
              <div className="flex justify-between px-3.5 py-2 bg-blue-50 text-blue-900 font-bold">
                <span>{isBn ? 'ফেরত টাকা (Change Return):' : 'Change Return:'}</span>
                <span className="font-mono font-bold text-blue-700">
                  {currency} {(memo.paidAmount - memo.totalAmount).toLocaleString()}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer Signatures */}
        <div className="mt-12 pt-6 border-t border-slate-300 flex justify-between items-end text-xs text-slate-700 font-medium">
          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1">
              {isBn ? 'ক্রেতার স্বাক্ষর' : 'Customer Signature'}
            </div>
          </div>

          <div className="text-center w-36">
            <div className="border-t border-slate-900 pt-1 font-bold text-slate-900">
              {isBn ? 'বিক্রেতার স্বাক্ষর' : 'Authorized Signature'}
            </div>
          </div>
        </div>

        {/* Memo Footer Terms */}
        <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[11px] text-slate-500 italic">
          {shopSettings.footerText || 'ভুলত্রুটি সংশোধনযোগ্য। বিক্রিত মাল ফেরত নেওয়া হয় না। ধন্যবাদ, আবার আসবেন।'}
        </div>
      </div>
    </div>
  );
};
