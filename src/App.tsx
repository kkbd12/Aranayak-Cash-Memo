import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CashMemoBuilder } from './components/CashMemoBuilder';
import { PrintableMemo } from './components/PrintableMemo';
import { SalesDatabase } from './components/SalesDatabase';
import { ProductCatalog } from './components/ProductCatalog';
import { ShopSettingsView } from './components/ShopSettingsView';
import { PaymentModal } from './components/PaymentModal';

import { CashMemo, Product, ShopSettings, DailySalesSummary } from './types';
import { initialShopSettings, initialProducts, initialMemos } from './data/initialData';
import {
  auth,
  signInWithGoogle,
  logOut,
  subscribeToShopData,
  saveMemoToCloud,
  deleteMemoFromCloud,
  saveSettingsToCloud,
  saveProductToCloud,
  deleteProductFromCloud,
  syncLocalDataToCloud,
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Cloud, CheckCircle, AlertTriangle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'builder' | 'database' | 'products' | 'settings'>('builder');
  const [lang, setLang] = useState<'bn' | 'en'>('bn');

  // Firebase User & Cloud Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncStatusBanner, setSyncStatusBanner] = useState<string | null>(null);

  // Application Data States
  const [shopSettings, setShopSettings] = useState<ShopSettings>(initialShopSettings);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [memos, setMemos] = useState<CashMemo[]>(initialMemos);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Daily Sales Summary State
  const [summary, setSummary] = useState<DailySalesSummary>({
    date: selectedDate,
    totalMemos: 0,
    totalSalesAmount: 0,
    totalPaidAmount: 0,
    totalDueAmount: 0,
    cashPaid: 0,
    mobileBankingPaid: 0,
    cardPaid: 0,
  });

  // Modal States
  const [previewMemo, setPreviewMemo] = useState<CashMemo | null>(null);
  const [paymentMemo, setPaymentMemo] = useState<CashMemo | null>(null);

  // Fetch initial data from server APIs with localStorage fallback
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setShopSettings(data);
        localStorage.setItem('pos_settings_backup', JSON.stringify(data));
      } else {
        const local = localStorage.getItem('pos_settings_backup');
        if (local) setShopSettings(JSON.parse(local));
      }
    } catch (err) {
      console.warn('API fetch settings error, using local storage fallback:', err);
      const local = localStorage.getItem('pos_settings_backup');
      if (local) setShopSettings(JSON.parse(local));
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        localStorage.setItem('pos_products_backup', JSON.stringify(data));
      } else {
        const local = localStorage.getItem('pos_products_backup');
        if (local) setProducts(JSON.parse(local));
      }
    } catch (err) {
      console.warn('API fetch products error, using local storage fallback:', err);
      const local = localStorage.getItem('pos_products_backup');
      if (local) setProducts(JSON.parse(local));
    }
  };

  const fetchMemos = async () => {
    try {
      const res = await fetch('/api/memos');
      if (res.ok) {
        const data = await res.json();
        setMemos(data);
        localStorage.setItem('pos_memos_backup', JSON.stringify(data));
      } else {
        const local = localStorage.getItem('pos_memos_backup');
        if (local) setMemos(JSON.parse(local));
      }
    } catch (err) {
      console.warn('API fetch memos error, using local storage fallback:', err);
      const local = localStorage.getItem('pos_memos_backup');
      if (local) setMemos(JSON.parse(local));
    }
  };

  // Keep localStorage automatically synchronized whenever state changes
  useEffect(() => {
    if (memos.length > 0) {
      localStorage.setItem('pos_memos_backup', JSON.stringify(memos));
    }
  }, [memos]);

  useEffect(() => {
    if (products.length > 0) {
      localStorage.setItem('pos_products_backup', JSON.stringify(products));
    }
  }, [products]);

  useEffect(() => {
    localStorage.setItem('pos_settings_backup', JSON.stringify(shopSettings));
  }, [shopSettings]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsCloudSyncing(true);
        // Upload initial local data to cloud if cloud doesn't have them
        await syncLocalDataToCloud(user.uid, {
          settings: shopSettings,
          products,
          memos,
        });

        // Set up real-time listener for multi-device sync
        const unsubscribeShopData = subscribeToShopData(user.uid, {
          onSettingsChange: (cloudSettings) => {
            if (cloudSettings && cloudSettings.shopName) {
              setShopSettings(cloudSettings);
            }
          },
          onProductsChange: (cloudProducts) => {
            if (cloudProducts && cloudProducts.length > 0) {
              setProducts(cloudProducts);
            }
          },
          onMemosChange: (cloudMemos) => {
            if (cloudMemos) {
              setMemos(cloudMemos);
            }
          },
        });

        setIsCloudSyncing(false);
        setSyncStatusBanner(
          lang === 'bn'
            ? 'গুগল ক্লাউড সিঙ্ক চালু হয়েছে! এখন যেকোনো মোবাইল বা কম্পিউটার থেকে ডাটা সুরক্ষিত থাকবে।'
            : 'Cloud sync active! Your data is accessible from any mobile or desktop.'
        );
        setTimeout(() => setSyncStatusBanner(null), 6000);

        return () => unsubscribeShopData();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLoginWithGoogle = async () => {
    try {
      setIsCloudSyncing(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Login error:', err);
      alert(lang === 'bn' ? 'গুগল লগইনে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' : 'Google Sign-In failed. Please retry.');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      setCurrentUser(null);
      setSyncStatusBanner(
        lang === 'bn'
          ? 'লগআউট সম্পন্ন। ডাটা আপনার ব্রাউজারের লোকাল মেমরিতে সুরক্ষিত আছে।'
          : 'Signed out. Local cache is active.'
      );
      setTimeout(() => setSyncStatusBanner(null), 4000);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const fetchSummary = async (dateStr: string) => {
    try {
      const res = await fetch(`/api/summary?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      // Calculate locally as fallback
      const daysMemos = memos.filter((m) => m.date === dateStr);
      setSummary({
        date: dateStr,
        totalMemos: daysMemos.length,
        totalSalesAmount: daysMemos.reduce((s, m) => s + m.totalAmount, 0),
        totalPaidAmount: daysMemos.reduce((s, m) => s + m.paidAmount, 0),
        totalDueAmount: daysMemos.reduce((s, m) => s + m.dueAmount, 0),
        cashPaid: daysMemos.filter((m) => m.paymentMethod === 'Cash').reduce((s, m) => s + m.paidAmount, 0),
        mobileBankingPaid: daysMemos.filter((m) => ['bKash', 'Nagad', 'Rocket'].includes(m.paymentMethod)).reduce((s, m) => s + m.paidAmount, 0),
        cardPaid: daysMemos.filter((m) => ['Card', 'Bank'].includes(m.paymentMethod)).reduce((s, m) => s + m.paidAmount, 0),
      });
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchProducts();
    fetchMemos();
  }, []);

  useEffect(() => {
    fetchSummary(selectedDate);
  }, [memos, selectedDate]);

  // Full System 1-Click Backup Export & Restore
  const handleExportFullBackup = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      shopSettings,
      products,
      memos,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CashMemo_DataBackup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreFullBackup = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const targetSettings = data.shopSettings || data.settings;
      const targetProducts = data.products;
      const targetMemos = data.memos;

      if (!Array.isArray(targetMemos) && !Array.isArray(targetProducts) && !targetSettings) {
        throw new Error('Invalid backup file structure');
      }

      if (targetSettings) {
        setShopSettings(targetSettings);
        localStorage.setItem('pos_settings_backup', JSON.stringify(targetSettings));
        if (currentUser) {
          saveSettingsToCloud(currentUser.uid, targetSettings);
        }
      }
      if (Array.isArray(targetProducts)) {
        setProducts(targetProducts);
        localStorage.setItem('pos_products_backup', JSON.stringify(targetProducts));
        if (currentUser) {
          for (const prod of targetProducts) {
            saveProductToCloud(currentUser.uid, prod);
          }
        }
      }
      if (Array.isArray(targetMemos)) {
        setMemos(targetMemos);
        localStorage.setItem('pos_memos_backup', JSON.stringify(targetMemos));
        if (currentUser) {
          for (const memo of targetMemos) {
            saveMemoToCloud(currentUser.uid, memo);
          }
        }
      }

      // Sync with server
      await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: targetSettings,
          products: targetProducts,
          memos: targetMemos,
        }),
      });

      return true;
    } catch (err) {
      console.error('Failed to restore backup:', err);
      return false;
    }
  };

  // Handlers
  const handleSaveMemo = async (memoData: Omit<CashMemo, 'id' | 'createdAt'>): Promise<CashMemo | null> => {
    let savedMemo: CashMemo | null = null;
    try {
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoData),
      });

      if (res.ok) {
        const { memo, settings: updatedSettings } = await res.json();
        savedMemo = memo;
        setMemos((prev) => [memo, ...prev]);
        if (updatedSettings) {
          setShopSettings(updatedSettings);
        }
      } else {
        // Fallback local creation if server unavailable
        const newMemo: CashMemo = {
          ...memoData,
          id: `memo-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        savedMemo = newMemo;
        setMemos((prev) => [newMemo, ...prev]);
        setShopSettings((prev) => ({ ...prev, nextMemoNumber: prev.nextMemoNumber + 1 }));
      }
    } catch (err) {
      console.error('Error saving memo:', err);
      const newMemo: CashMemo = {
        ...memoData,
        id: `memo-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      savedMemo = newMemo;
      setMemos((prev) => [newMemo, ...prev]);
    }

    // Save to Firestore Cloud if user is signed in
    if (savedMemo && currentUser) {
      saveMemoToCloud(currentUser.uid, savedMemo).catch((e) =>
        console.warn('Cloud save memo error:', e)
      );
    }

    return savedMemo;
  };

  const handleDeleteMemo = async (id: string) => {
    try {
      await fetch(`/api/memos/${id}`, { method: 'DELETE' });
      setMemos((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setMemos((prev) => prev.filter((m) => m.id !== id));
    }

    // Delete in Firestore
    if (currentUser) {
      deleteMemoFromCloud(currentUser.uid, id).catch((e) =>
        console.warn('Cloud delete memo error:', e)
      );
    }
  };

  const handleUpdatePaymentOnMemo = async (updatedMemo: CashMemo) => {
    try {
      const res = await fetch(`/api/memos/${updatedMemo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMemo),
      });
      if (res.ok) {
        const saved = await res.json();
        setMemos((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      } else {
        setMemos((prev) => prev.map((m) => (m.id === updatedMemo.id ? updatedMemo : m)));
      }
    } catch (err) {
      setMemos((prev) => prev.map((m) => (m.id === updatedMemo.id ? updatedMemo : m)));
    }

    // Update in Firestore
    if (currentUser) {
      saveMemoToCloud(currentUser.uid, updatedMemo).catch((e) =>
        console.warn('Cloud update memo error:', e)
      );
    }
  };

  // Product Catalog Actions
  const handleAddProduct = async (prodData: Omit<Product, 'id'>) => {
    let savedProd: Product | null = null;
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prodData),
      });
      if (res.ok) {
        const newProd = await res.json();
        savedProd = newProd;
        setProducts((prev) => [newProd, ...prev]);
      } else {
        const newProd: Product = { ...prodData, id: `prod-${Date.now()}` };
        savedProd = newProd;
        setProducts((prev) => [newProd, ...prev]);
      }
    } catch (err) {
      const newProd: Product = { ...prodData, id: `prod-${Date.now()}` };
      savedProd = newProd;
      setProducts((prev) => [newProd, ...prev]);
    }

    // Save to Firestore
    if (savedProd && currentUser) {
      saveProductToCloud(currentUser.uid, savedProd).catch((e) =>
        console.warn('Cloud save product error:', e)
      );
    }
  };

  const handleUpdateProduct = async (id: string, prodData: Partial<Product>) => {
    let updatedObj: Product | null = null;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prodData),
      });
      if (res.ok) {
        const updated = await res.json();
        updatedObj = updated;
        setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      } else {
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id === id) {
              const u = { ...p, ...prodData };
              updatedObj = u;
              return u;
            }
            return p;
          })
        );
      }
    } catch (err) {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            const u = { ...p, ...prodData };
            updatedObj = u;
            return u;
          }
          return p;
        })
      );
    }

    // Save to Firestore
    if (updatedObj && currentUser) {
      saveProductToCloud(currentUser.uid, updatedObj).catch((e) =>
        console.warn('Cloud update product error:', e)
      );
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }

    if (currentUser) {
      deleteProductFromCloud(currentUser.uid, id).catch((e) =>
        console.warn('Cloud delete product error:', e)
      );
    }
  };

  // Settings Actions
  const handleSaveSettings = async (newSettings: ShopSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const saved = await res.json();
        setShopSettings(saved);
      } else {
        setShopSettings(newSettings);
      }
    } catch (err) {
      setShopSettings(newSettings);
    }

    if (currentUser) {
      saveSettingsToCloud(currentUser.uid, newSettings).catch((e) =>
        console.warn('Cloud save settings error:', e)
      );
    }
  };

  // Compute Today's Metrics for Header
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMemos = memos.filter((m) => m.date === todayStr);
  const todaySalesCount = todayMemos.length;
  const todayRevenue = todayMemos.reduce((sum, m) => sum + m.totalAmount, 0);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        shopSettings={shopSettings}
        lang={lang}
        setLang={setLang}
        todaySalesCount={todaySalesCount}
        todayRevenue={todayRevenue}
        currentUser={currentUser}
        isCloudSyncing={isCloudSyncing}
        onLoginWithGoogle={handleLoginWithGoogle}
        onLogout={handleLogout}
      />

      {/* Cloud Sync Announcement Banner */}
      {syncStatusBanner && (
        <div className="bg-emerald-600 text-white text-xs font-bold py-2.5 px-4 text-center shadow-md flex items-center justify-center gap-2 transition-all">
          <CheckCircle className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{syncStatusBanner}</span>
          <button
            onClick={() => setSyncStatusBanner(null)}
            className="ml-3 text-emerald-200 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sign-in Callout if in local mode */}
      {!currentUser && (
        <div className="bg-indigo-900/90 text-white text-xs py-2 px-4 border-b border-indigo-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-indigo-300 shrink-0" />
            <span className="font-medium">
              {lang === 'bn'
                ? 'যেকোনো মোবাইল বা ল্যাপটপ থেকে একই দোকানের হিসাব চালাতে গুগল দিয়ে লগইন করুন।'
                : 'Connect with Google to access your store cash memos from any device anytime.'}
            </span>
          </div>
          <button
            onClick={handleLoginWithGoogle}
            className="bg-white text-indigo-950 px-3 py-1 rounded-lg font-extrabold text-[11px] hover:bg-indigo-50 transition cursor-pointer shadow-xs"
          >
            {lang === 'bn' ? 'গুগল দিয়ে ক্লাউড কানেক্ট করুন' : 'Connect Google Cloud'}
          </button>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'builder' && (
          <CashMemoBuilder
            shopSettings={shopSettings}
            products={products}
            memos={memos}
            onSaveMemo={handleSaveMemo}
            onPrintMemo={(memo) => setPreviewMemo(memo)}
            lang={lang}
          />
        )}

        {activeTab === 'database' && (
          <SalesDatabase
            memos={memos}
            shopSettings={shopSettings}
            summary={summary}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onViewMemo={(memo) => setPreviewMemo(memo)}
            onDeleteMemo={handleDeleteMemo}
            onUpdatePayment={(memo) => setPaymentMemo(memo)}
            lang={lang}
            onExportBackup={handleExportFullBackup}
            onRestoreBackup={handleRestoreFullBackup}
          />
        )}

        {activeTab === 'products' && (
          <ProductCatalog
            products={products}
            shopSettings={shopSettings}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            lang={lang}
          />
        )}

        {activeTab === 'settings' && (
          <ShopSettingsView
            settings={shopSettings}
            onSaveSettings={handleSaveSettings}
            lang={lang}
            onExportBackup={handleExportFullBackup}
            onRestoreBackup={handleRestoreFullBackup}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print bg-slate-900 text-slate-400 py-4 px-6 border-t border-slate-800 text-center text-xs">
        <p>
          © {new Date().getFullYear()} {shopSettings.shopName || 'Sales Cash Memo System'}.{' '}
          {lang === 'bn' ? 'সকল অধিকার সংরক্ষিত।' : 'All Rights Reserved.'}
        </p>
      </footer>

      {/* Print Preview Modal */}
      {previewMemo && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <PrintableMemo
              memo={previewMemo}
              shopSettings={shopSettings}
              lang={lang}
              onClose={() => setPreviewMemo(null)}
            />
          </div>
        </div>
      )}

      {/* Payment Record Modal */}
      {paymentMemo && (
        <PaymentModal
          memo={paymentMemo}
          shopSettings={shopSettings}
          onSavePayment={handleUpdatePaymentOnMemo}
          onClose={() => setPaymentMemo(null)}
          lang={lang}
        />
      )}
    </div>
  );
}

