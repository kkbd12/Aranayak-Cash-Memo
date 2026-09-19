import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  getDocFromServer,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { CashMemo, Customer, Product, ShopSettings } from '../types';
import { getNextAvailableMemoNumber, repairDuplicateMemos } from '../utils/memoNumberGenerator';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfigData) : getApp();

// Initialize Auth & Firestore
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);

// Standard Firestore Error Handler (as per Firebase integration specification)
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Deep sanitize helper: removes any `undefined` values that cause Firestore setDoc/updateDoc to throw
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

// Connection test on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently offline.');
      return false;
    }
    return true;
  }
}

// Sign-In with Google (with detailed error diagnostics)
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Google Sign-In error details:', error);
    if (error?.code === 'auth/popup-blocked') {
      throw new Error('ব্রাউজারের পপ-আপ (Pop-up) ব্লক করা আছে। ব্রাউজার অ্যাড্রেস বার থেকে Pop-up Allow করুন।');
    } else if (error?.code === 'auth/unauthorized-domain') {
      throw new Error('এই ডোমেনটি ফায়ারবেসে অনুমোদিত (Authorized Domain) তালিকায় নেই।');
    } else if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('সাইন-ইন উইন্ডো বন্ধ করা হয়েছে।');
    } else if (error?.code === 'auth/network-request-failed') {
      throw new Error('ইন্টারনেট সংযোগে ত্রুটি হয়েছে। আপনার নেটওয়ার্ক কানেকশন চেক করুন।');
    }
    throw error;
  }
};

// Sign-Out
export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-Out error:', error);
    throw error;
  }
};

// Real-time Firestore Sync Helper
export const subscribeToShopData = (
  userId: string,
  callbacks: {
    onSettingsChange: (settings: ShopSettings) => void;
    onProductsChange: (products: Product[]) => void;
    onMemosChange: (memos: CashMemo[]) => void;
    onCustomersChange?: (customers: Customer[]) => void;
    onError?: (error: unknown) => void;
  }
) => {
  const userShopDocRef = doc(db, 'shops', userId);
  const productsColRef = collection(db, 'shops', userId, 'products');
  const memosColRef = collection(db, 'shops', userId, 'memos');
  const customersColRef = collection(db, 'shops', userId, 'customers');

  // 1. Settings listener
  const unsubSettings = onSnapshot(
    userShopDocRef,
    (snap) => {
      if (snap.exists()) {
        callbacks.onSettingsChange(snap.data() as ShopSettings);
      }
    },
    (err) => {
      console.warn('Firestore settings listener error:', err);
      handleFirestoreError(err, OperationType.GET, `shops/${userId}`);
      if (callbacks.onError) callbacks.onError(err);
    }
  );

  // 2. Products listener
  const unsubProducts = onSnapshot(
    productsColRef,
    (snap) => {
      const prods: Product[] = [];
      snap.forEach((d) => prods.push(d.data() as Product));
      callbacks.onProductsChange(prods);
    },
    (err) => {
      console.warn('Firestore products listener error:', err);
      handleFirestoreError(err, OperationType.LIST, `shops/${userId}/products`);
      if (callbacks.onError) callbacks.onError(err);
    }
  );

  // 3. Customers listener
  const unsubCustomers = onSnapshot(
    customersColRef,
    (snap) => {
      const custs: Customer[] = [];
      snap.forEach((d) => custs.push(d.data() as Customer));
      if (callbacks.onCustomersChange) {
        callbacks.onCustomersChange(custs);
      }
    },
    (err) => {
      console.warn('Firestore customers listener error:', err);
      handleFirestoreError(err, OperationType.LIST, `shops/${userId}/customers`);
      if (callbacks.onError) callbacks.onError(err);
    }
  );

  // 4. Memos listener
  let unsubMemosFallback: (() => void) | null = null;
  const memosQuery = query(memosColRef, orderBy('createdAt', 'desc'));
  const unsubMemos = onSnapshot(
    memosQuery,
    (snap) => {
      const memoList: CashMemo[] = [];
      snap.forEach((d) => memoList.push(d.data() as CashMemo));
      callbacks.onMemosChange(memoList);
    },
    (err) => {
      console.warn('Primary memos query failed, switching to unordered fallback:', err);
      // Fallback query without orderBy
      unsubMemosFallback = onSnapshot(
        memosColRef,
        (snap2) => {
          const memoList: CashMemo[] = [];
          snap2.forEach((d) => memoList.push(d.data() as CashMemo));
          memoList.sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
          callbacks.onMemosChange(memoList);
        },
        (err2) => {
          console.error('Fallback memos listener error:', err2);
          handleFirestoreError(err2, OperationType.LIST, `shops/${userId}/memos`);
          if (callbacks.onError) callbacks.onError(err2);
        }
      );
    }
  );

  return () => {
    unsubSettings();
    unsubProducts();
    unsubCustomers();
    unsubMemos();
    if (unsubMemosFallback) unsubMemosFallback();
  };
};

// Save a memo to Firestore with undefined sanitization
export const saveMemoToCloud = async (userId: string, memo: CashMemo): Promise<void> => {
  const path = `shops/${userId}/memos/${memo.id}`;
  try {
    const memoRef = doc(db, 'shops', userId, 'memos', memo.id);
    const safeData = sanitizeForFirestore(memo);
    await setDoc(memoRef, safeData, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
};

// Delete a memo from Firestore
export const deleteMemoFromCloud = async (userId: string, memoId: string): Promise<void> => {
  const path = `shops/${userId}/memos/${memoId}`;
  try {
    const memoRef = doc(db, 'shops', userId, 'memos', memoId);
    await deleteDoc(memoRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
};

// Clear all memos from Firestore
export const clearAllMemosFromCloud = async (userId: string): Promise<void> => {
  const path = `shops/${userId}/memos`;
  try {
    const memosCol = collection(db, 'shops', userId, 'memos');
    const snap = await getDocs(memosCol);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
};

// Save shop settings to Firestore with undefined sanitization
export const saveSettingsToCloud = async (
  userId: string,
  settings: ShopSettings
): Promise<void> => {
  const path = `shops/${userId}`;
  try {
    const shopRef = doc(db, 'shops', userId);
    const safeData = sanitizeForFirestore({
      ...settings,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(shopRef, safeData, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
};

// Save a product to Firestore with undefined sanitization
export const saveProductToCloud = async (userId: string, product: Product): Promise<void> => {
  const path = `shops/${userId}/products/${product.id}`;
  try {
    const productRef = doc(db, 'shops', userId, 'products', product.id);
    const safeData = sanitizeForFirestore(product);
    await setDoc(productRef, safeData, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
};

// Delete a product from Firestore
export const deleteProductFromCloud = async (userId: string, productId: string): Promise<void> => {
  const path = `shops/${userId}/products/${productId}`;
  try {
    const productRef = doc(db, 'shops', userId, 'products', productId);
    await deleteDoc(productRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
};

// Save a customer to Firestore with undefined sanitization
export const saveCustomerToCloud = async (userId: string, customer: Customer): Promise<void> => {
  const path = `shops/${userId}/customers/${customer.id}`;
  try {
    const customerRef = doc(db, 'shops', userId, 'customers', customer.id);
    const safeData = sanitizeForFirestore(customer);
    await setDoc(customerRef, safeData, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
};

// Delete a customer from Firestore
export const deleteCustomerFromCloud = async (userId: string, customerId: string): Promise<void> => {
  const path = `shops/${userId}/customers/${customerId}`;
  try {
    const customerRef = doc(db, 'shops', userId, 'customers', customerId);
    await deleteDoc(customerRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
};

// Full Bidirectional Smart Sync between Local state and Firestore Cloud
export interface SyncResult {
  settings: ShopSettings;
  products: Product[];
  memos: CashMemo[];
  customers?: Customer[];
  stats: {
    cloudMemosCount: number;
    cloudProductsCount: number;
    cloudCustomersCount?: number;
    uploadedMemosCount: number;
    uploadedProductsCount: number;
    uploadedCustomersCount?: number;
  };
}

export const syncLocalAndCloudData = async (
  userId: string,
  localData: { settings: ShopSettings; products: Product[]; memos: CashMemo[]; customers?: Customer[] }
): Promise<SyncResult> => {
  try {
    // 1. Fetch Cloud Settings
    const shopRef = doc(db, 'shops', userId);
    const shopSnap = await getDoc(shopRef);
    let resolvedSettings = localData.settings;

    if (shopSnap.exists()) {
      const cloudSettings = shopSnap.data() as ShopSettings;
      if (cloudSettings && cloudSettings.shopName) {
        resolvedSettings = cloudSettings;
      }
    } else {
      // First time initialization: write local settings to cloud
      await setDoc(shopRef, sanitizeForFirestore({
        ...localData.settings,
        initializedAt: new Date().toISOString(),
        ownerId: userId,
      }));
    }

    // 2. Fetch Cloud Products
    const productsCol = collection(db, 'shops', userId, 'products');
    const productsSnap = await getDocs(productsCol);
    const cloudProductsMap = new Map<string, Product>();
    productsSnap.forEach((d) => {
      const p = d.data() as Product;
      cloudProductsMap.set(p.id, p);
    });

    let uploadedProductsCount = 0;
    // Push local products that are missing from cloud
    for (const prod of localData.products) {
      if (!cloudProductsMap.has(prod.id)) {
        await setDoc(doc(db, 'shops', userId, 'products', prod.id), sanitizeForFirestore(prod));
        cloudProductsMap.set(prod.id, prod);
        uploadedProductsCount++;
      }
    }
    const resolvedProducts = Array.from(cloudProductsMap.values());

    // 3. Fetch Cloud Memos
    const memosCol = collection(db, 'shops', userId, 'memos');
    const memosSnap = await getDocs(memosCol);
    const cloudMemosMap = new Map<string, CashMemo>();
    memosSnap.forEach((d) => {
      const m = d.data() as CashMemo;
      cloudMemosMap.set(m.id, m);
    });

    let uploadedMemosCount = 0;
    // Push local memos that are missing from cloud
    for (const memo of localData.memos) {
      if (!cloudMemosMap.has(memo.id)) {
        await setDoc(doc(db, 'shops', userId, 'memos', memo.id), sanitizeForFirestore(memo));
        cloudMemosMap.set(memo.id, memo);
        uploadedMemosCount++;
      }
    }
    const resolvedMemos = Array.from(cloudMemosMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    // 4. Fetch Cloud Customers
    const customersCol = collection(db, 'shops', userId, 'customers');
    const customersSnap = await getDocs(customersCol);
    const cloudCustomersMap = new Map<string, Customer>();
    customersSnap.forEach((d) => {
      const c = d.data() as Customer;
      cloudCustomersMap.set(c.id, c);
    });

    let uploadedCustomersCount = 0;
    if (localData.customers && Array.isArray(localData.customers)) {
      for (const cust of localData.customers) {
        if (!cloudCustomersMap.has(cust.id)) {
          await setDoc(doc(db, 'shops', userId, 'customers', cust.id), sanitizeForFirestore(cust));
          cloudCustomersMap.set(cust.id, cust);
          uploadedCustomersCount++;
        }
      }
    }
    const resolvedCustomers = Array.from(cloudCustomersMap.values());

    // Check for and repair any legacy duplicate memo numbers
    const repairResult = repairDuplicateMemos(resolvedMemos, resolvedSettings.invoicePrefix || 'MEMO-');
    const finalMemos = repairResult.changed ? repairResult.memos : resolvedMemos;
    if (repairResult.changed) {
      for (const m of finalMemos) {
        setDoc(doc(db, 'shops', userId, 'memos', m.id), sanitizeForFirestore(m), { merge: true }).catch((e) =>
          console.warn('Repaired memo cloud sync warning:', e)
        );
      }
    }

    // Ensure nextMemoNumber is guaranteed strictly higher than any existing memo in cloud
    const nextAuto = getNextAvailableMemoNumber(finalMemos, resolvedSettings);
    if ((resolvedSettings.nextMemoNumber || 0) < nextAuto.nextNumber - 1) {
      resolvedSettings = {
        ...resolvedSettings,
        nextMemoNumber: nextAuto.nextNumber - 1,
      };
      setDoc(shopRef, sanitizeForFirestore({
        ...resolvedSettings,
        updatedAt: new Date().toISOString(),
      }), { merge: true }).catch((e) => console.warn('Cloud nextMemoNumber update warning:', e));
    }

    return {
      settings: resolvedSettings,
      products: resolvedProducts,
      memos: finalMemos,
      customers: resolvedCustomers,
      stats: {
        cloudMemosCount: cloudMemosMap.size,
        cloudProductsCount: cloudProductsMap.size,
        cloudCustomersCount: cloudCustomersMap.size,
        uploadedMemosCount,
        uploadedProductsCount,
        uploadedCustomersCount,
      },
    };
  } catch (err) {
    console.error('Error during syncLocalAndCloudData:', err);
    handleFirestoreError(err, OperationType.WRITE, `shops/${userId}`);
    throw err;
  }
};

// Legacy alias for compatibility
export const syncLocalDataToCloud = async (
  userId: string,
  data: { settings: ShopSettings; products: Product[]; memos: CashMemo[] }
) => {
  return syncLocalAndCloudData(userId, data);
};
