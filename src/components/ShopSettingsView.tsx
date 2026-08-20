import React, { useState, useRef } from 'react';
import { Settings, Store, Phone, MapPin, FileText, Check, Save, HardDriveDownload, Upload, ShieldCheck, Database } from 'lucide-react';
import { ShopSettings } from '../types';

interface ShopSettingsViewProps {
  settings: ShopSettings;
  onSaveSettings: (newSettings: ShopSettings) => Promise<void>;
  lang: 'bn' | 'en';
  onExportBackup?: () => void;
  onRestoreBackup?: (file: File) => Promise<boolean>;
}

export const ShopSettingsView: React.FC<ShopSettingsViewProps> = ({
  settings,
  onSaveSettings,
  lang,
  onExportBackup,
  onRestoreBackup,
}) => {
  const isBn = lang === 'bn';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ShopSettings>({ ...settings });
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSaveSettings(formData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Bento Header Tile */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold flex items-center gap-2.5">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Settings className="w-5 h-5" />
            </span>
            <span>{isBn ? 'দোকানের তথ্য ও মেমো সেটিংস' : 'Shop & Memo Configuration'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1.5 font-medium">
            {isBn
              ? 'এখানে দেওয়া দোকানের নাম, ঠিকানা ও মোবাইল নম্বর আপনার সকল ক্যাশ মেমোর হেডার ও হেডারে প্রিন্ট হবে।'
              : 'Configure store title, phones, address, and receipt terms printed on customer memos.'}
          </p>
        </div>
      </div>

      {/* Settings Form Card */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
        {isSaved && (
          <div className="bg-emerald-50 border border-emerald-300/80 text-emerald-800 p-3.5 rounded-2xl text-xs font-bold flex items-center space-x-2">
            <Check className="w-4.5 h-4.5 text-emerald-600" />
            <span>{isBn ? 'দোকানের সেটিংস সফলভাবে সেভ হয়েছে!' : 'Settings updated successfully!'}</span>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600" />
            <span>{isBn ? '১. দোকানের বিবরণ (Store Profile)' : '1. Store Profile'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                {isBn ? 'দোকানের লোগো (Shop Logo)' : 'Shop Logo'}
              </label>
              <div className="flex flex-wrap items-center gap-4">
                {formData.logoUrl ? (
                  <div className="relative group">
                    <img
                      src={formData.logoUrl}
                      alt="Shop Logo"
                      className="w-16 h-16 object-contain rounded-xl border border-slate-300 bg-white p-1"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: '' })}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 text-xs hover:bg-red-700 shadow cursor-pointer"
                      title={isBn ? 'লোগো মুছে ফেলুন' : 'Remove Logo'}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 text-xs text-center p-1 font-semibold">
                    {isBn ? 'নো লোগো' : 'No Logo'}
                  </div>
                )}

                <div className="flex-1 space-y-2 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <label className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer transition shadow-xs inline-flex items-center gap-1.5">
                      <span>🖼️ {isBn ? 'লোগো ছবি আপলোড করুন' : 'Upload Logo File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              alert(isBn ? 'ছবিটি সর্বোচ্চ 2MB হতে পারবে।' : 'File size must be under 2MB.');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setFormData({ ...formData, logoUrl: event.target.result as string });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder={isBn ? 'অথবা লোগো ছবির লিংক (URL) দিন' : 'Or enter logo image URL'}
                    value={formData.logoUrl || ''}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'দোকানের নাম (Shop Name)*' : 'Shop Name*'}
              </label>
              <input
                type="text"
                required
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'প্রোপ্রাইটর / মালিকের নাম' : 'Proprietor Name'}
              </label>
              <input
                type="text"
                value={formData.proprietorName}
                onChange={(e) => setFormData({ ...formData, proprietorName: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'প্রধান মোবাইল নম্বর*' : 'Primary Mobile*'}
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'বিকল্প মোবাইল নম্বর' : 'Alt Mobile'}
              </label>
              <input
                type="text"
                value={formData.altPhone || ''}
                onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'দোকানের পূর্ণাঙ্গ ঠিকানা*' : 'Full Shop Address*'}
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>{isBn ? '২. ক্যাশ মেমো ফরম্যাট ও নম্বর' : '2. Memo & Invoice Setup'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'মেমো প্রেফিক্স (Memo Prefix)' : 'Invoice Prefix'}
              </label>
              <input
                type="text"
                value={formData.invoicePrefix}
                onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'পরবর্তী মেমো নম্বর' : 'Next Memo Number'}
              </label>
              <input
                type="number"
                value={formData.nextMemoNumber}
                onChange={(e) => setFormData({ ...formData, nextMemoNumber: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-sm font-mono font-black border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50 text-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'মুদ্রা প্রতীক (Currency Symbol)' : 'Currency Symbol'}
              </label>
              <input
                type="text"
                value={formData.currencySymbol}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'মেমোর নিচের ফুটার লেখা / শর্তাবলী' : 'Memo Footer Terms'}
            </label>
            <textarea
              rows={2}
              value={formData.footerText}
              onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50 font-medium"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl flex items-center space-x-2 shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isLoading ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'সেটিংস সেভ করুন' : 'Save Settings')}</span>
          </button>
        </div>
      </form>

      {/* Hidden File Input for Restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Section 3: Data Protection, Backup & Restore */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span>{isBn ? 'ডাটা সংরক্ষণ ও ব্যাকআপ সুবিধা (১০০% নিরাপদ ও ফ্রি)' : 'Data Storage & Backup (100% Free & Safe)'}</span>
          </h3>
          <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
            {isBn ? 'অটো-সিঙ্ক সক্রিয়' : 'Auto-Sync Active'}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          {isBn
            ? 'আপনার দোকানের সমস্ত মেমো, কাস্টমার তালিকা ও প্রোডাক্ট তথ্য স্বয়ংক্রিয়ভাবে সার্ভার ও আপনার ব্রাউজারের লোকাল মেমরিতে সুরক্ষিত থাকে। অতিরিক্ত সুরক্ষার জন্য যেকোনো সময় ১-ক্লিকে ব্যাকআপ ফাইল ডাউনলোড করে রাখতে পারেন।'
            : 'All memos, customer records, and product lists are safely preserved in server and local browser cache. Download a full JSON backup anytime.'}
        </p>

        {restoreMessage && (
          <div className="bg-emerald-500 text-white font-bold p-3 rounded-xl text-xs">
            {restoreMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {onExportBackup && (
            <button
              type="button"
              onClick={onExportBackup}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 transition shadow-xs cursor-pointer"
            >
              <HardDriveDownload className="w-4 h-4 text-emerald-400" />
              <span>{isBn ? 'সম্পূর্ণ ডাটা ব্যাকআপ ডাউনলোড (JSON)' : 'Download Full Backup (JSON)'}</span>
            </button>
          )}

          {onRestoreBackup && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-200 flex items-center space-x-2 transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-600" />
              <span>{isBn ? 'ব্যাকআপ ফাইল রিস্টোর করুন' : 'Restore from Backup'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
