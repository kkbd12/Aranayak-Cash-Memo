import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { CashMemo, Product, ShopSettings } from '../types';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfigData) : getApp();

// Initialize Auth & Firestore
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId);

// Enable offline IndexedDB persistence for instantaneous offline/online handling
try {
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not supported by browser');
      }
    });
  }
} catch (e) {
  // Ignored if already initialized or not supported
}

// Sign-In with Google (with popup and fallback)
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Google Sign-In error details:', error);
    // If popup was blocked or closed by user, throw informative message
    if (error?.code === 'auth/popup-blocked') {
      throw new Error('পপ-আপ উইন্ডোটি ব্লক করা হয়েছে। ব্রাউজারের Pop-up Allow করুন।');
    } else if (error?.code === 'auth/unauthorized-domain') {
      throw new Error('এই ডোমেইনটি ফায়ারবেসে অনুমোদিত (Authorized) করা নেই। Firebase Console > Authentication > Settings > Authorized Domains-এ আপনার ওয়েবসাইট ডোমেইন যোগ করুন।');
    } else if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('সাইন-ইন উইন্ডোটি বন্ধ করে দেওয়া হয়েছে।');
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

// Real-time Firestore Sync Helpers
export const subscribeToShopData = (
  userId: string,
  callbacks: {
    onSettingsChange: (settings: ShopSettings) => void;
    onProductsChange: (products: Product[]) => void;
    onMemosChange: (memos: CashMemo[]) => void;
  }
) => {
  const userShopDocRef = doc(db, 'shops', userId);
  const productsColRef = collection(db, 'shops', userId, 'products');
  const memosColRef = collection(db, 'shops', userId, 'memos');

  // 1. Settings listener
  const unsubSettings = onSnapshot(
    userShopDocRef,
    (snap) => {
      if (snap.exists()) {
        callbacks.onSettingsChange(snap.data() as ShopSettings);
      }
    },
    (err) => console.warn('Firestore settings listener error:', err)
  );

  // 2. Products listener
  const unsubProducts = onSnapshot(
    productsColRef,
    (snap) => {
      const prods: Product[] = [];
      snap.forEach((d) => prods.push(d.data() as Product));
      callbacks.onProductsChange(prods);
    },
    (err) => console.warn('Firestore products listener error:', err)
  );

  // 3. Memos listener (ordered by createdAt descending)
  const memosQuery = query(memosColRef, orderBy('createdAt', 'desc'));
  const unsubMemos = onSnapshot(
    memosQuery,
    (snap) => {
      const memoList: CashMemo[] = [];
      snap.forEach((d) => memoList.push(d.data() as CashMemo));
      callbacks.onMemosChange(memoList);
    },
    (err) => {
      // Fallback query without orderBy if index not yet generated
      onSnapshot(memosColRef, (snap2) => {
        const memoList: CashMemo[] = [];
        snap2.forEach((d) => memoList.push(d.data() as CashMemo));
        memoList.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        callbacks.onMemosChange(memoList);
      });
    }
  );

  return () => {
    unsubSettings();
    unsubProducts();
    unsubMemos();
  };
};

// Save a memo to Firestore
export const saveMemoToCloud = async (userId: string, memo: CashMemo): Promise<void> => {
  const memoRef = doc(db, 'shops', userId, 'memos', memo.id);
  await setDoc(memoRef, memo, { merge: true });
};

// Delete a memo from Firestore
export const deleteMemoFromCloud = async (userId: string, memoId: string): Promise<void> => {
  const memoRef = doc(db, 'shops', userId, 'memos', memoId);
  await deleteDoc(memoRef);
};

// Clear all memos from Firestore
export const clearAllMemosFromCloud = async (userId: string): Promise<void> => {
  try {
    const memosCol = collection(db, 'shops', userId, 'memos');
    const snap = await getDocs(memosCol);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.error('Error clearing cloud memos:', err);
  }
};

// Save shop settings to Firestore
export const saveSettingsToCloud = async (
  userId: string,
  settings: ShopSettings
): Promise<void> => {
  const shopRef = doc(db, 'shops', userId);
  await setDoc(shopRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
};

// Save a product to Firestore
export const saveProductToCloud = async (userId: string, product: Product): Promise<void> => {
  const productRef = doc(db, 'shops', userId, 'products', product.id);
  await setDoc(productRef, product, { merge: true });
};

// Delete a product from Firestore
export const deleteProductFromCloud = async (userId: string, productId: string): Promise<void> => {
  const productRef = doc(db, 'shops', userId, 'products', productId);
  await deleteDoc(productRef);
};

// Bulk push local data to Cloud when a user connects their account
export const syncLocalDataToCloud = async (
  userId: string,
  data: { settings: ShopSettings; products: Product[]; memos: CashMemo[] }
) => {
  try {
    const shopRef = doc(db, 'shops', userId);
    const shopSnap = await getDoc(shopRef);

    // If this shop already exists on cloud, don't re-upload demo data!
    if (shopSnap.exists()) {
      return;
    }

    // First time connecting this user: mark as initialized and upload current state
    await setDoc(shopRef, { ...data.settings, initializedAt: new Date().toISOString() });

    // Only upload non-demo or real user memos
    for (const memo of data.memos) {
      await setDoc(doc(db, 'shops', userId, 'memos', memo.id), memo);
    }

    for (const prod of data.products) {
      await setDoc(doc(db, 'shops', userId, 'products', prod.id), prod);
    }
  } catch (err) {
    console.error('Error syncing local data to cloud:', err);
  }
};
