import React from 'react';
import {
  FileText,
  Database,
  Package,
  Settings,
  PlusCircle,
  ShoppingBag,
  Globe,
  Cloud,
  CloudCheck,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { ShopSettings } from '../types';
import { User } from 'firebase/auth';

interface HeaderProps {
  activeTab: 'builder' | 'database' | 'products' | 'settings';
  setActiveTab: (tab: 'builder' | 'database' | 'products' | 'settings') => void;
  shopSettings: ShopSettings;
  lang: 'bn' | 'en';
  setLang: (lang: 'bn' | 'en') => void;
  todaySalesCount: number;
  todayRevenue: number;
  currentUser: User | null;
  isCloudSyncing: boolean;
  onLoginWithGoogle: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  shopSettings,
  lang,
  setLang,
  todaySalesCount,
  todayRevenue,
  currentUser,
  isCloudSyncing,
  onLoginWithGoogle,
  onLogout,
}) => {
  const isBn = lang === 'bn';

  return (
    <header className="bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800/80 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between py-3.5 gap-3.5">
          {/* Shop Title & Identity */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 flex items-center justify-center font-bold text-xl shadow-md shadow-emerald-500/20 shrink-0">
              {shopSettings.logoUrl ? (
                <img
                  src={shopSettings.logoUrl}
                  alt={shopSettings.shopName}
                  className="w-10 h-10 object-contain rounded-xl"
                />
              ) : (
                <ShoppingBag className="w-6 h-6 text-slate-950" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  {shopSettings.shopName || (isBn ? 'ক্যাশ মেমো ও সেলস ট্র্যাকার' : 'Sales Cash Memo System')}
                </h1>
                {currentUser ? (
                  <span className="bg-emerald-500/15 text-emerald-300 text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <Cloud className="w-3 h-3 text-emerald-400" />
                    <span>{isBn ? 'ক্লাউডে লাইভ সিঙ্ক' : 'Cloud Synced'}</span>
                  </span>
                ) : (
                  <span className="bg-amber-500/15 text-amber-300 text-[11px] px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold tracking-wide flex items-center gap-1.5">
                    <Cloud className="w-3 h-3 text-amber-400" />
                    <span>{isBn ? 'লোকাল মোড' : 'Local Mode'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {shopSettings.address} • {shopSettings.phone}
              </p>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="hidden sm:flex items-center space-x-3 bg-slate-800/90 px-3.5 py-2 rounded-2xl border border-slate-700/70 text-xs shadow-inner">
              <div>
                <span className="text-slate-400 block font-medium">{isBn ? 'আজকের বিক্রি:' : 'Today Sales:'}</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">{todaySalesCount} {isBn ? 'টি মেমো' : 'Memos'}</span>
              </div>
              <div className="h-7 w-px bg-slate-700/80"></div>
              <div>
                <span className="text-slate-400 block font-medium">{isBn ? 'আজকের মোট আয়:' : 'Revenue:'}</span>
                <span className="font-extrabold text-white font-mono text-sm">{shopSettings.currencySymbol} {todayRevenue.toLocaleString()}</span>
              </div>
            </div>

            {/* Google Auth / Cloud Sign-In Button */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-6 h-6 rounded-full border border-emerald-400 object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                    {currentUser.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="hidden md:block text-left max-w-[130px] truncate">
                  <span className="font-bold text-white block text-[11px] truncate">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold block">
                    {isBn ? 'ক্লাউড সংযুক্ত' : 'Online'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title={isBn ? 'লগআউট করুন' : 'Sign Out'}
                  className="p-1 text-slate-400 hover:text-rose-300 hover:bg-slate-700 rounded-lg transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onLoginWithGoogle}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-xl font-bold flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
                title={isBn ? 'গুগল দিয়ে লগইন করুন (যেকোনো ডিভাইস থেকে ডাটা পেতে)' : 'Sign in with Google for cloud sync'}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isBn ? 'গুগল লগইন' : 'Google Login'}</span>
              </button>
            )}

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
              className="flex items-center space-x-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700/80 transition-all shadow-xs cursor-pointer"
              title={isBn ? 'Switch to English' : 'বাংলায় পরিবর্তন করুন'}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>

            {/* Quick Memo Creator Button */}
            <button
              onClick={() => setActiveTab('builder')}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isBn ? 'নতুন মেমো' : 'New Memo'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Bento Style Pills */}
        <div className="flex space-x-1.5 overflow-x-auto pt-1 pb-2.5 border-t border-slate-800/70 text-sm no-scrollbar">
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'builder'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isBn ? 'ক্যাশ মেমো তৈরি' : 'Create Cash Memo'}</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'database'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>{isBn ? 'দৈনিক সেলস ডাটাবেস' : 'Daily Sales Database'}</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'products'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{isBn ? 'পণ্য ও স্টক তালিকা' : 'Product Catalog'}</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{isBn ? 'দোকান সেটিং' : 'Shop Settings'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
