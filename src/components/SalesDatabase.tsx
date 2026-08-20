import React, { useState, useRef } from 'react';
import {
  Database,
  Calendar,
  Search,
  Printer,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  HardDriveDownload,
  Upload,
  Layers,
  History,
} from 'lucide-react';
import { CashMemo, DailySalesSummary, ShopSettings } from '../types';

interface SalesDatabaseProps {
  memos: CashMemo[];
  shopSettings: ShopSettings;
  summary: DailySalesSummary;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onViewMemo: (memo: CashMemo) => void;
  onDeleteMemo: (id: string) => void;
  onUpdatePayment: (memo: CashMemo) => void;
  lang: 'bn' | 'en';
  onExportBackup?: () => void;
  onRestoreBackup?: (file: File) => Promise<boolean>;
  onClearAllMemos?: () => void;
}

export const SalesDatabase: React.FC<SalesDatabaseProps> = ({
  memos,
  shopSettings,
  summary,
  selectedDate,
  setSelectedDate,
  onViewMemo,
  onDeleteMemo,
  onUpdatePayment,
  lang,
  onExportBackup,
  onRestoreBackup,
  onClearAllMemos,
}) => {
  const isBn = lang === 'bn';
  const currency = shopSettings.currencySymbol || '৳';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Partial' | 'Due'>('All');
  const [dateRangeMode, setDateRangeMode] = useState<'all' | 'today' | 'yesterday' | 'week' | 'custom'>('all');
  const [memoToDelete, setMemoToDelete] = useState<CashMemo | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Helper date strings
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  const sevenDaysAgoObj = new Date();
  sevenDaysAgoObj.setDate(sevenDaysAgoObj.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgoObj.toISOString().split('T')[0];

  // Filter Memos by search, status, and selected date range
  const filteredMemos = memos.filter((memo) => {
    const matchesSearch =
      memo.memoNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memo.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memo.customerPhone.includes(searchQuery);

    const matchesStatus = statusFilter === 'All' || memo.status === statusFilter;

    let matchesDate = true;
    if (dateRangeMode === 'today') {
      matchesDate = memo.date === todayStr;
    } else if (dateRangeMode === 'yesterday') {
      matchesDate = memo.date === yesterdayStr;
    } else if (dateRangeMode === 'week') {
      matchesDate = memo.date >= sevenDaysAgoStr && memo.date <= todayStr;
    } else if (dateRangeMode === 'custom') {
      matchesDate = memo.date === selectedDate;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Calculate dynamic metrics for currently active date selection
  const rangeMemos = memos.filter((memo) => {
    if (dateRangeMode === 'today') return memo.date === todayStr;
    if (dateRangeMode === 'yesterday') return memo.date === yesterdayStr;
    if (dateRangeMode === 'week') return memo.date >= sevenDaysAgoStr && memo.date <= todayStr;
    if (dateRangeMode === 'custom') return memo.date === selectedDate;
    return true; // 'all'
  });

  const activeTotalSales = rangeMemos.reduce((sum, m) => sum + m.totalAmount, 0);
  const activePaidSales = rangeMemos.reduce((sum, m) => sum + m.paidAmount, 0);
  const activeDueSales = rangeMemos.reduce((sum, m) => sum + m.dueAmount, 0);
  const activeCashSales = rangeMemos.filter((m) => m.paymentMethod === 'Cash').reduce((sum, m) => sum + m.paidAmount, 0);
  const activeDigitalSales = rangeMemos.filter((m) => m.paymentMethod !== 'Cash').reduce((sum, m) => sum + m.paidAmount, 0);

  // File Upload / Restore Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onRestoreBackup) {
      const ok = await onRestoreBackup(file);
      if (ok) {
        setRestoreMessage(isBn ? 'ডাটা ব্যাকআপ সফলভাবে রিস্টোর হয়েছে!' : 'Data backup restored successfully!');
      } else {
        setRestoreMessage(isBn ? 'ব্যাকআপ ফাইলটি সঠিক নয়!' : 'Failed to restore backup file!');
      }
      setTimeout(() => setRestoreMessage(null), 4000);
    }
    if (e.target) e.target.value = '';
  };

  // Download CSV Export
  const exportToCSV = () => {
    const headers = [
      'Memo No',
      'Date',
      'Time',
      'Customer Name',
      'Phone',
      'Total Items',
      'Subtotal',
      'Discount',
      'Delivery Charge',
      'Total Amount',
      'Paid Amount',
      'Due Amount',
      'Payment Method',
      'Status',
    ];

    const rows = filteredMemos.map((m) => [
      m.memoNo,
      m.date,
      m.time || '',
      `"${m.customerName}"`,
      m.customerPhone,
      m.items.length,
      m.subtotal,
      m.discount,
      m.shipping || 0,
      m.totalAmount,
      m.paidAmount,
      m.dueAmount,
      m.paymentMethod,
      m.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Database_${dateRangeMode}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input for Restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Restore Banner Alert */}
      {restoreMessage && (
        <div className="bg-emerald-500 text-white font-bold p-3.5 rounded-2xl flex items-center justify-between text-xs shadow-md">
          <span>{restoreMessage}</span>
          <button onClick={() => setRestoreMessage(null)} className="text-white hover:text-slate-200">✕</button>
        </div>
      )}

      {/* Top Header & Daily Report Overview - Bento Header */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2.5">
              <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Database className="w-5 h-5" />
              </span>
              <span>{isBn ? 'সেলস ডাটাবেস ও মেমো হিস্ট্রি' : 'Sales Database & Memo History'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              {isBn
                ? 'গতকাল বা যেকোনো দিনের মোট বিক্রি, জমা ও বকেয়া হিসাব একনজরে দেখুন।'
                : 'Track daily/historical revenue, collected cash, pending balance, and invoice archives.'}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Free JSON Backup Download */}
            {onExportBackup && (
              <button
                type="button"
                onClick={onExportBackup}
                title={isBn ? 'সম্পূর্ণ ডাটার ব্যাকআপ ফাইল ডাউনলোড করুন (ফ্রি)' : 'Download full data JSON backup (Free)'}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 rounded-xl font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
              >
                <HardDriveDownload className="w-4 h-4" />
                <span>{isBn ? 'ডাটা ব্যাকআপ (JSON)' : 'Backup JSON'}</span>
              </button>
            )}

            {/* Restore Backup */}
            {onRestoreBackup && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={isBn ? 'পূর্বের ব্যাকআপ ফাইল থেকে ডাটা ফিরিয়ে আনুন' : 'Restore from JSON backup'}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl border border-slate-700 font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>{isBn ? 'রিস্টোর (Restore)' : 'Restore'}</span>
              </button>
            )}

            {/* CSV Export */}
            <button
              onClick={exportToCSV}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-3.5 py-2 rounded-xl border border-slate-700 font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{isBn ? 'CSV এক্সপোর্ট' : 'Export CSV'}</span>
            </button>

            {/* Clear All Memos Button */}
            {onClearAllMemos && memos.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearAllModal(true)}
                title={isBn ? 'সকল মেমো ও বিক্রির হিসাব সম্পূর্ণ সাফ করুন' : 'Clear all sales records'}
                className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-200 text-xs px-3.5 py-2 rounded-xl border border-rose-800/80 font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>{isBn ? 'সব মেমো সাফ করুন' : 'Clear All'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Filter Quick Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
          <div className="flex items-center space-x-1.5 text-xs font-bold overflow-x-auto">
            <span className="text-slate-400 mr-1 text-[11px] uppercase tracking-wider">{isBn ? 'তারিখ নির্বাচন:' : 'Date:'}</span>
            
            <button
              onClick={() => setDateRangeMode('all')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                dateRangeMode === 'all'
                  ? 'bg-emerald-500 text-slate-900 font-extrabold shadow-xs'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isBn ? 'সকল রেকর্ড (All Time)' : 'All Time'}
            </button>

            <button
              onClick={() => {
                setDateRangeMode('today');
                setSelectedDate(todayStr);
              }}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                dateRangeMode === 'today'
                  ? 'bg-emerald-500 text-slate-900 font-extrabold shadow-xs'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isBn ? 'আজ (Today)' : 'Today'}
            </button>

            <button
              onClick={() => {
                setDateRangeMode('yesterday');
                setSelectedDate(yesterdayStr);
              }}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                dateRangeMode === 'yesterday'
                  ? 'bg-amber-400 text-slate-900 font-extrabold shadow-xs'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isBn ? 'গতকাল (Yesterday)' : 'Yesterday'}
            </button>

            <button
              onClick={() => setDateRangeMode('week')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                dateRangeMode === 'week'
                  ? 'bg-emerald-500 text-slate-900 font-extrabold shadow-xs'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isBn ? 'গত ৭ দিন' : 'Last 7 Days'}
            </button>

            <button
              onClick={() => setDateRangeMode('custom')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                dateRangeMode === 'custom'
                  ? 'bg-emerald-500 text-slate-900 font-extrabold shadow-xs'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isBn ? 'নির্দিষ্ট তারিখ' : 'Custom Date'}
            </button>
          </div>

          {/* Specific Date Picker Input */}
          <div className="flex items-center space-x-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setDateRangeMode('custom');
              }}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* 4 Dynamic Summary Metric Bento Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Sales */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 hover:border-slate-600 transition shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1.5">
              <span>{isBn ? 'মোট বিক্রি (Total Sales)' : 'Total Revenue'}</span>
              <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-white">
              {currency} {activeTotalSales.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
              {rangeMemos.length} {isBn ? 'টি মেমো সম্পন্ন' : 'memos generated'}
            </p>
          </div>

          {/* Paid / Cash Collected */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 hover:border-slate-600 transition shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1.5">
              <span>{isBn ? 'সংগৃহীত টাকা (Collected)' : 'Total Received'}</span>
              <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <CheckCircle className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
              {currency} {activePaidSales.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
              {isBn ? 'ক্যাশ:' : 'Cash:'} {currency}{activeCashSales.toLocaleString()} | {isBn ? 'ডিজিটাল:' : 'Digital:'} {currency}{activeDigitalSales.toLocaleString()}
            </p>
          </div>

          {/* Due Amount */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 hover:border-slate-600 transition shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1.5">
              <span>{isBn ? 'মোট বকেয়া (Pending Due)' : 'Pending Due'}</span>
              <span className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg">
                <AlertCircle className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-rose-400">
              {currency} {activeDueSales.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
              {isBn ? 'ভবিষ্যতে আদায়যোগ্য' : 'To be collected'}
            </p>
          </div>

          {/* Total Memos */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 hover:border-slate-600 transition shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1.5">
              <span>{isBn ? 'কাস্টমার ইনভয়েস' : 'Total Invoices'}</span>
              <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg">
                <Database className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-sky-300">
              {rangeMemos.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
              {dateRangeMode === 'all'
                ? (isBn ? 'সর্বমোট রেকর্ড' : 'All-time records')
                : dateRangeMode === 'yesterday'
                ? (isBn ? `গতকাল (${yesterdayStr})` : `Yesterday (${yesterdayStr})`)
                : dateRangeMode === 'today'
                ? (isBn ? `আজ (${todayStr})` : `Today (${todayStr})`)
                : dateRangeMode === 'week'
                ? (isBn ? 'গত ৭ দিনের রেকর্ড' : 'Last 7 Days')
                : selectedDate}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="bg-white p-4.5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3.5">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={isBn ? 'গ্রাহকের নাম, মোবাইল বা মেমো নং খুঁজুন...' : 'Search customer or memo...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium bg-slate-50/50"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center space-x-1.5 text-xs font-bold w-full md:w-auto overflow-x-auto">
          <span className="text-slate-500 mr-2 whitespace-nowrap">{isBn ? 'ফিল্টার:' : 'Filter:'}</span>
          {(['All', 'Paid', 'Partial', 'Due'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              {st === 'All'
                ? isBn ? 'সকল (All)' : 'All'
                : st === 'Paid'
                ? isBn ? 'পরিশোধিত' : 'Paid'
                : st === 'Partial'
                ? isBn ? 'আংশিক বকেয়া' : 'Partial'
                : isBn ? 'বকেয়া' : 'Due'}
            </button>
          ))}
        </div>
      </div>

      {/* Database Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-900 text-white font-extrabold uppercase text-[11px] tracking-wider">
                <th className="p-3.5">{isBn ? 'মেমো নং' : 'Memo No'}</th>
                <th className="p-3.5">{isBn ? 'তারিখ ও সময়' : 'Date & Time'}</th>
                <th className="p-3.5">{isBn ? 'গ্রাহকের তথ্য' : 'Customer Info'}</th>
                <th className="p-3.5 text-center">{isBn ? 'আইটেম' : 'Items'}</th>
                <th className="p-3.5 text-right">{isBn ? 'মোট টাকা' : 'Total'}</th>
                <th className="p-3.5 text-right">{isBn ? 'জমা' : 'Paid'}</th>
                <th className="p-3.5 text-right">{isBn ? 'বকেয়া' : 'Due'}</th>
                <th className="p-3.5 text-center">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                <th className="p-3.5 text-center">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMemos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500 font-bold">
                    {isBn ? 'কোন মেমো বা বিক্রির রেকর্ড পাওয়া যায়নি।' : 'No sales records found.'}
                  </td>
                </tr>
              ) : (
                filteredMemos.map((memo) => (
                  <tr key={memo.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-extrabold text-emerald-700">
                      {memo.memoNo}
                    </td>
                    <td className="p-3.5 text-slate-600 text-xs">
                      <div className="font-bold text-slate-900">{memo.date}</div>
                      <div className="text-slate-400 font-medium">{memo.time || ''}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{memo.customerName}</div>
                      <div className="text-xs text-slate-500 font-medium">{memo.customerPhone || 'N/A'}</div>
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                      {memo.items.length}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-slate-900">
                      {currency} {memo.totalAmount.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-mono font-extrabold text-emerald-700">
                      {currency} {memo.paidAmount.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-rose-600">
                      {memo.dueAmount > 0 ? `${currency} ${memo.dueAmount.toLocaleString()}` : '-'}
                    </td>
                    <td className="p-3.5 text-center">
                      {memo.status === 'Paid' ? (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{isBn ? 'পরিশোধিত' : 'Paid'}</span>
                        </span>
                      ) : memo.status === 'Partial' ? (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200/80">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>{isBn ? 'আংশিক বকেয়া' : 'Partial'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-800 border border-rose-200/80">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>{isBn ? 'বকেয়া' : 'Due'}</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {/* View & Print Memo */}
                        <button
                          onClick={() => onViewMemo(memo)}
                          className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
                          title={isBn ? 'মেমো দেখুন ও প্রিন্ট করুন' : 'View & Print Memo'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Record Payment for Due */}
                        {memo.dueAmount > 0 && (
                          <button
                            onClick={() => onUpdatePayment(memo)}
                            className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition"
                            title={isBn ? 'বকেয়া টাকা জমা করুন' : 'Record Due Payment'}
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Memo */}
                        <button
                          onClick={() => setMemoToDelete(memo)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                          title={isBn ? 'মুছে ফেলুন' : 'Delete Record'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {memoToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3.5 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100/80">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {isBn ? 'মেমো মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Memo Deletion'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isBn ? 'এই মেমোটির রেকর্ড স্থায়ীভাবে মুছে যাবে।' : 'This record will be permanently deleted.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-slate-600">{isBn ? 'মেমো নম্বর:' : 'Memo No:'}</span>
                <span className="text-emerald-700 font-mono font-black">{memoToDelete.memoNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{isBn ? 'গ্রাহকের নাম:' : 'Customer:'}</span>
                <span className="font-extrabold text-slate-900">{memoToDelete.customerName}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/80 pt-2 mt-1 font-bold">
                <span className="text-slate-700">{isBn ? 'সর্বমোট মূল্য:' : 'Total Amount:'}</span>
                <span className="text-slate-900 font-mono font-black text-sm">
                  {currency} {memoToDelete.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMemoToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteMemo(memoToDelete.id);
                  setMemoToDelete(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-rose-600/20 flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBn ? 'হ্যাঁ, মুছে ফেলুন' : 'Delete Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Clear All Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3.5 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100/80">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {isBn ? 'সকল মেমো মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Clear All Records'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isBn
                    ? 'ডাটাবেসের সকল ক্যাশ মেমো ও হিসাব স্থায়ীভাবে মুছে যাবে।'
                    : 'All sales cash memo records will be permanently removed.'}
                </p>
              </div>
            </div>

            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 text-xs text-rose-800 space-y-1">
              <p className="font-bold">
                ⚠️ {isBn ? 'মোট মেমোর সংখ্যা:' : 'Total Memos to delete:'} {memos.length}{' '}
                {isBn ? 'টি' : ''}
              </p>
              <p className="text-[11px] text-rose-700">
                {isBn
                  ? 'আপনি যদি নতুন করে আসল দোকানের হিসাব শুরু করতে চান, তবে এটি নিশ্চিত করুন।'
                  : 'Confirm only if you want to start fresh without sample records.'}
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllMemos) {
                    onClearAllMemos();
                  }
                  setShowClearAllModal(false);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBn ? 'হ্যাঁ, সব মেমো মুছে ফেলুন' : 'Clear All Memos'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
