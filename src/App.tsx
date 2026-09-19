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
  getNextAvailableMemoNumber,
  repairDuplicateMemos,
  isMemoNoDuplicate,
} from './utils/memoNumberGenerator';
import {
  auth,
  signInWithGoogle,
  logOut,
  subscribeToShopData,
  saveMemoToCloud,
  deleteMemoFromCloud,
  clearAllMemosFromCloud,
  saveSettingsToCloud,
  saveProductToCloud,
  deleteProductFromCloud,
  syncLocalAndCloudData,
  testFirestoreConnection,
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Cloud, CheckCircle, AlertTriangle } from 'lucide-react';
import { CloudSyncModal } from './components/CloudSyncModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'builder' | 'database' | 'products' | 'settings'>('builder');
  const [lang, setLang] = useState<'bn' | 'en'>('bn');

  // Firebase User & Cloud Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncStatusBanner, setSyncStatusBanner] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Application Data States (lazy initialized from localStorage first)
  const [shopSettings, setShopSettings] = useState<ShopSettings>(() => {
    try {
      const local = localStorage.getItem('pos_settings_backup');
      return local ? JSON.parse(local) : initialShopSettings;
    } catch {
      return initialShopSettings;
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const local = localStorage.getItem('pos_products_backup');
      if (local !== null) {
        const parsed: Product[] = JSON.parse(local);
        return parsed.map((p) => {
          const initMatch = initialProducts.find((ip) => ip.id === p.id || ip.code === p.code || ip.name === p.name);
          if (initMatch && initMatch.variants && (!p.variants || p.variants.length === 0)) {
            return { ...p, variants: initMatch.variants };
          }
          return p;
        });
      }
      return initialProducts;
    } catch {
      return initialProducts;
    }
  });

  const [memos, setMemos] = useState<CashMemo[]>(() => {
    try {
      const local = localStorage.getItem('pos_memos_backup');
      return local !== null ? JSON.parse(local) : initialMemos;
    } catch {
      return initialMemos;
    }
  });

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
        if (data && data.shopName) {
          setShopSettings(data);
          localStorage.setItem('pos_settings_backup', JSON.stringify(data));
        }
      }
    } catch (err) {
      console.warn('API fetch settings error, using local state:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const local = localStorage.getItem('pos_products_backup');
      if (local !== null) {
        // User already has local product state, don't overwrite with server demo
        return;
      }
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        localStorage.setItem('pos_products_backup', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('API fetch products error:', err);
    }
  };

  const fetchMemos = async () => {
    try {
      const local = localStorage.getItem('pos_memos_backup');
      if (local !== null) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const prefix = shopSettings.invoicePrefix || 'MEMO-';
            const repair = repairDuplicateMemos(parsed, prefix);
            if (repair.changed) {
              setMemos(repair.memos);
              localStorage.setItem('pos_memos_backup', JSON.stringify(repair.memos));
              return;
            }
          }
        } catch (e) {
          console.warn('Local memos parse error:', e);
        }
        return;
      }
      const res = await fetch('/api/memos');
      if (res.ok) {
        const data = await res.json();
        setMemos(data);
        localStorage.setItem('pos_memos_backup', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('API fetch memos error:', err);
    }
  };

  // Keep localStorage automatically synchronized whenever state changes
  useEffect(() => {
    localStorage.setItem('pos_memos_backup', JSON.stringify(memos));
  }, [memos]);

  useEffect(() => {
    localStorage.setItem('pos_products_backup', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('pos_settings_backup', JSON.stringify(shopSettings));
  }, [shopSettings]);

  // Test Firestore connection on boot (Skill Section 1)
  useEffect(() => {
    testFirestoreConnection().catch((err) => {
      console.warn('Firestore initial boot check:', err);
    });
  }, []);

  // Helper for Bidirectional Local & Firestore Cloud Synchronization
  const performBidirectionalSync = async (userToSync: User) => {
    try {
      setIsCloudSyncing(true);
      setSyncError(null);

      // Read most up-to-date localStorage state to prevent stale state issues
      let localSettings = shopSettings;
      let localProducts = products;
      let localMemos = memos;

      try {
        const s = localStorage.getItem('pos_settings_backup');
        if (s) localSettings = JSON.parse(s);
        const p = localStorage.getItem('pos_products_backup');
        if (p) localProducts = JSON.parse(p);
        const m = localStorage.getItem('pos_memos_backup');
        if (m) localMemos = JSON.parse(m);
      } catch (e) {
        console.warn('Error reading local cache before sync:', e);
      }

      const syncResult = await syncLocalAndCloudData(userToSync.uid, {
        settings: localSettings,
        products: localProducts,
        memos: localMemos,
      });

      if (syncResult) {
        setShopSettings(syncResult.settings);
        setProducts(syncResult.products);
        setMemos(syncResult.memos);

        localStorage.setItem('pos_settings_backup', JSON.stringify(syncResult.settings));
        localStorage.setItem('pos_products_backup', JSON.stringify(syncResult.products));
        localStorage.setItem('pos_memos_backup', JSON.stringify(syncResult.memos));

        const nowTime = new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setLastSyncedAt(nowTime);

        // Keep local Express backend in sync too
        fetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: syncResult.settings,
            products: syncResult.products,
            memos: syncResult.memos,
          }),
        }).catch((e) => console.warn('Express server sync update skipped:', e));
      }
    } catch (err: any) {
      console.error('Bidirectional sync error:', err);
      const errMsg =
        err?.message || (lang === 'bn' ? 'ক্লাউড ডেটাবেসের সাথে সংযোগে সমস্যা হয়েছে।' : 'Failed to connect to Cloud Database.');
      setSyncError(errMsg);
      throw err;
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    let unsubscribeShopData: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (unsubscribeShopData) {
        unsubscribeShopData();
        unsubscribeShopData = null;
      }

      if (user) {
        try {
          await performBidirectionalSync(user);
          setSyncStatusBanner(
            lang === 'bn'
              ? 'গুগল ক্লাউড লাইভ সিঙ্ক সক্রিয় হয়েছে! আপনার মেমো ও পণ্য ক্লাউডে রিয়েল-টাইমে সংরক্ষিত।'
              : 'Google Cloud Live Sync active! Your memos and products are synced in real time.'
          );
          setTimeout(() => setSyncStatusBanner(null), 5000);
        } catch (e) {
          console.warn('Initial sync warning on auth:', e);
        }

        // Set up real-time listener for multi-device sync
        unsubscribeShopData = subscribeToShopData(user.uid, {
          onSettingsChange: (cloudSettings) => {
            if (cloudSettings && cloudSettings.shopName) {
              setShopSettings((prev) => ({
                ...cloudSettings,
                // Ensure nextMemoNumber never downgrades to a lower/stale number
                nextMemoNumber: Math.max(prev.nextMemoNumber || 1001, cloudSettings.nextMemoNumber || 1001),
              }));
              localStorage.setItem('pos_settings_backup', JSON.stringify(cloudSettings));
            }
          },
          onProductsChange: (cloudProducts) => {
            if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
              setProducts(cloudProducts);
              localStorage.setItem('pos_products_backup', JSON.stringify(cloudProducts));
            }
          },
          onMemosChange: (cloudMemos) => {
            if (cloudMemos && Array.isArray(cloudMemos)) {
              const prefix = shopSettings.invoicePrefix || 'MEMO-';
              const repair = repairDuplicateMemos(cloudMemos, prefix);
              const finalMemos = repair.changed ? repair.memos : cloudMemos;
              setMemos(finalMemos);
              localStorage.setItem('pos_memos_backup', JSON.stringify(finalMemos));
            }
          },
          onError: (err) => {
            console.warn('Real-time sync listener notice:', err);
          },
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeShopData) {
        unsubscribeShopData();
      }
    };
  }, []);

  const handleLoginWithGoogle = async () => {
    try {
      setIsCloudSyncing(true);
      setSyncError(null);
      const user = await signInWithGoogle();
      if (user) {
        setSyncStatusBanner(
          lang === 'bn'
            ? 'গুগল লগইন সম্পন্ন! ক্লাউডে লাইভ সিঙ্ক শুরু হয়েছে।'
            : 'Google Sign-in successful! Live sync initiated.'
        );
        setTimeout(() => setSyncStatusBanner(null), 5000);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err?.message || (lang === 'bn' ? 'গুগল লগইনে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' : 'Google Sign-In failed. Please retry.');
      setSyncError(msg);
      setIsSyncModalOpen(true);
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
          ? 'লগআউট সম্পন্ন। ডাটা আপনার ডিভাইসের লোকাল মেমরিতে সুরক্ষিত আছে।'
          : 'Signed out. Data remains cached locally.'
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
    let activeSettings: ShopSettings = shopSettings;

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
          activeSettings = updatedSettings;
        }
      } else {
        // Fallback local creation if server unavailable
        const autoNext = getNextAvailableMemoNumber(memos, shopSettings);
        const finalNo = memoData.memoNo && !isMemoNoDuplicate(memoData.memoNo, memos)
          ? memoData.memoNo
          : autoNext.memoNo;

        const newMemo: CashMemo = {
          ...memoData,
          id: `memo-${Date.now()}`,
          memoNo: finalNo,
          createdAt: new Date().toISOString(),
        };
        savedMemo = newMemo;
        setMemos((prev) => [newMemo, ...prev]);
      }
    } catch (err) {
      console.error('Error saving memo:', err);
      const autoNext = getNextAvailableMemoNumber(memos, shopSettings);
      const finalNo = memoData.memoNo && !isMemoNoDuplicate(memoData.memoNo, memos)
        ? memoData.memoNo
        : autoNext.memoNo;

      const newMemo: CashMemo = {
        ...memoData,
        id: `memo-${Date.now()}`,
        memoNo: finalNo,
        createdAt: new Date().toISOString(),
      };
      savedMemo = newMemo;
      setMemos((prev) => [newMemo, ...prev]);
    }

    // Advance shopSettings.nextMemoNumber strictly higher than all memos
    if (savedMemo) {
      const allMemos = [savedMemo, ...memos];
      const nextInfo = getNextAvailableMemoNumber(allMemos, activeSettings);
      const safeSettings: ShopSettings = {
        ...activeSettings,
        nextMemoNumber: Math.max(activeSettings.nextMemoNumber || 1001, nextInfo.nextNumber - 1),
      };

      setShopSettings(safeSettings);
      localStorage.setItem('pos_settings_backup', JSON.stringify(safeSettings));

      // Save to Firestore Cloud if user is signed in
      if (currentUser) {
        saveMemoToCloud(currentUser.uid, savedMemo).catch((e) =>
          console.warn('Cloud save memo error:', e)
        );
        saveSettingsToCloud(currentUser.uid, safeSettings).catch((e) =>
          console.warn('Cloud save settings error:', e)
        );
      }
    }

    return savedMemo;
  };

  // Repair duplicate memo numbers across the entire dataset
  const handleRepairDuplicateMemos = async () => {
    const prefix = shopSettings.invoicePrefix || 'MEMO-';
    const repair = repairDuplicateMemos(memos, prefix);
    if (repair.changed) {
      setMemos(repair.memos);
      localStorage.setItem('pos_memos_backup', JSON.stringify(repair.memos));

      const nextInfo = getNextAvailableMemoNumber(repair.memos, shopSettings);
      const safeSettings: ShopSettings = {
        ...shopSettings,
        nextMemoNumber: Math.max(shopSettings.nextMemoNumber || 1001, nextInfo.nextNumber - 1),
      };
      setShopSettings(safeSettings);
      localStorage.setItem('pos_settings_backup', JSON.stringify(safeSettings));

      // Attempt server update
      try {
        await fetch('/api/memos/repair-numbers', { method: 'POST' });
      } catch (e) {
        console.warn('Server repair error:', e);
      }

      // Sync to cloud if user logged in
      if (currentUser) {
        for (const m of repair.memos) {
          saveMemoToCloud(currentUser.uid, m).catch((e) => console.warn('Cloud memo repair sync:', e));
        }
        saveSettingsToCloud(currentUser.uid, safeSettings).catch((e) => console.warn('Cloud settings repair sync:', e));
      }

      setSyncStatusBanner(
        lang === 'bn'
          ? `সফলভাবে ${repair.repairedCount} টি ডুপ্লিকেট মেমো নম্বর ঠিক করা হয়েছে!`
          : `Successfully repaired ${repair.repairedCount} duplicate memo numbers!`
      );
      setTimeout(() => setSyncStatusBanner(null), 5000);
    }
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

  const handleClearAllMemos = async () => {
    setMemos([]);
    localStorage.setItem('pos_memos_backup', JSON.stringify([]));

    try {
      await fetch('/api/memos/clear-all', { method: 'POST' });
    } catch (e) {
      console.warn('Clear local backend memos error:', e);
    }

    if (currentUser) {
      clearAllMemosFromCloud(currentUser.uid).catch((e) =>
        console.warn('Clear cloud memos error:', e)
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
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
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
            onClearAllMemos={handleClearAllMemos}
            onRepairDuplicateMemos={handleRepairDuplicateMemos}
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
            onClearAllMemos={handleClearAllMemos}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
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

      {/* Cloud Sync Modal */}
      <CloudSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        currentUser={currentUser}
        isCloudSyncing={isCloudSyncing}
        lastSyncedAt={lastSyncedAt}
        memosCount={memos.length}
        productsCount={products.length}
        shopSettings={shopSettings}
        lang={lang}
        onLoginWithGoogle={handleLoginWithGoogle}
        onLogout={handleLogout}
        onForceSync={async () => {
          if (currentUser) {
            await performBidirectionalSync(currentUser);
          } else {
            await handleLoginWithGoogle();
          }
        }}
        syncError={syncError}
      />

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

