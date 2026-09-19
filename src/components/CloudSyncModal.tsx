import React, { useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogIn,
  LogOut,
  ShieldCheck,
  Server,
  Database,
  X,
  ExternalLink,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ShopSettings } from '../types';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  isCloudSyncing: boolean;
  lastSyncedAt: string | null;
  memosCount: number;
  productsCount: number;
  shopSettings: ShopSettings;
  lang: 'bn' | 'en';
  onLoginWithGoogle: () => void;
  onLogout: () => void;
  onForceSync: () => Promise<void>;
  syncError: string | null;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isCloudSyncing,
  lastSyncedAt,
  memosCount,
  productsCount,
  lang,
  onLoginWithGoogle,
  onLogout,
  onForceSync,
  syncError,
}) => {
  const [syncingNow, setSyncingNow] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const isBn = lang === 'bn';

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setSyncingNow(true);
    setSuccessMsg(null);
    try {
      await onForceSync();
      setSuccessMsg(
        isBn
          ? 'ক্লাউডের সাথে সফলভাবে সমস্ত ডাটা সিঙ্ক সম্পন্ন হয়েছে!'
          : 'All data successfully synchronized with Cloud Firestore!'
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Manual sync failed:', err);
    } finally {
      setSyncingNow(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">
                {isBn ? 'গুগল ক্লাউড লাইভ সিঙ্ক সেন্টার' : 'Google Cloud Live Sync Center'}
              </h3>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {isBn
                  ? 'রিয়েল-টাইম ফায়ারবেস ক্লাউড ডেটাবেস সিঙ্ক্রোনাইজেশন'
                  : 'Real-time multi-device cloud synchronization'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Indicator Card */}
          <div
            className={`p-4 rounded-2xl border flex items-start space-x-3.5 ${
              currentUser
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}
          >
            {currentUser ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            )}
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm">
                {currentUser
                  ? isBn
                    ? 'ক্লাউড লাইভ সিঙ্ক সক্রিয় রয়েছে'
                    : 'Cloud Live Sync is Active'
                  : isBn
                  ? 'লোকাল মোডে চলছে (ক্লাউড সিঙ্ক করতে লগইন করুন)'
                  : 'Local Mode (Sign in to enable Cloud Sync)'}
              </p>
              <p className="opacity-90 leading-relaxed">
                {currentUser
                  ? isBn
                    ? `আপনার ডাটা স্বয়ংক্রিয়ভাবে Google Cloud Firestore-এ ব্যাকআপ হচ্ছে। মোবাইল ও কম্পিউটার উভয় জায়গা থেকেই একই ডাটা পাবেন।`
                    : `Your data is backed up to Google Cloud Firestore in real time.`
                  : isBn
                  ? `বর্তমানে ডাটা শুধুমাত্র এই ব্রাউজারের মেমরিতে সংরক্ষিত হচ্ছে। ব্রাউজার ক্যাশ ক্লিয়ার করলে ডাটা যেন না হারায়, তার জন্য গুগল দিয়ে সাইন-ইন করুন।`
                  : `Currently running on local browser cache. Sign in with Google to protect your data.`}
              </p>
            </div>
          </div>

          {/* User Account Details */}
          {currentUser ? (
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'User'}
                      className="w-10 h-10 rounded-full border border-emerald-400 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      {currentUser.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">
                      {currentUser.displayName || 'Google User'}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono">{currentUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl font-bold flex items-center space-x-1 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isBn ? 'লগআউট' : 'Sign Out'}</span>
                </button>
              </div>

              {/* Sync Statistics */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">
                    {isBn ? 'মোট ক্যাশ মেমো' : 'Total Memos'}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    {memosCount} {isBn ? 'টি' : ''}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">
                    {isBn ? 'পণ্য ক্যাটালগ' : 'Catalog Products'}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    {productsCount} {isBn ? 'টি' : ''}
                  </span>
                </div>
              </div>

              {lastSyncedAt && (
                <p className="text-[11px] text-slate-500 text-center">
                  {isBn ? 'সর্বশেষ সিঙ্ক:' : 'Last Synced:'} <span className="font-medium text-slate-700">{lastSyncedAt}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center">
                <LogIn className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">
                  {isBn ? 'ক্লাউড সিঙ্ক চালু করতে গুগল দিয়ে লগইন করুন' : 'Sign In with Google'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {isBn
                    ? '১-ক্লিক গুগল লগইনের মাধ্যমে আপনার দোকানের মেমো ও পণ্যের তালিকা সুরক্ষিত রাখুন।'
                    : 'Sync and access your sales data seamlessly from mobile and desktop.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onLoginWithGoogle}
                disabled={isCloudSyncing}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {isCloudSyncing
                    ? isBn
                      ? 'লগইন হচ্ছে...'
                      : 'Signing in...'
                    : isBn
                    ? 'গুগল দিয়ে সাইন-ইন করুন'
                    : 'Sign In with Google'}
                </span>
              </button>
            </div>
          )}

          {/* Sync Success & Error Alerts */}
          {successMsg && (
            <div className="bg-emerald-100 text-emerald-800 text-xs font-bold p-3 rounded-xl border border-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {syncError && (
            <div className="bg-rose-50 text-rose-800 text-xs font-semibold p-3.5 rounded-xl border border-rose-200 space-y-1">
              <div className="flex items-center space-x-2 font-bold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{isBn ? 'সিঙ্ক করতে সমস্যা হয়েছে:' : 'Sync Error:'}</span>
              </div>
              <p className="text-[11px] leading-relaxed pl-6">{syncError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              {isBn ? 'বন্ধ করুন' : 'Close'}
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncingNow || isCloudSyncing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncingNow || isCloudSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {syncingNow || isCloudSyncing
                    ? isBn
                      ? 'সিঙ্ক হচ্ছে...'
                      : 'Syncing...'
                    : isBn
                    ? 'এখনই ক্লাউডে সিঙ্ক করুন'
                    : 'Force Sync Now'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
