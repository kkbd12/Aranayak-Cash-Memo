import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initialShopSettings, initialProducts, initialMemos } from './src/data/initialData';
import { CashMemo, Customer, Product, ShopSettings } from './src/types';
import {
  extractMemoNumber,
  getNextAvailableMemoNumber,
  repairDuplicateMemos,
} from './src/utils/memoNumberGenerator';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Database storage setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface LocalDB {
  settings: ShopSettings;
  products: Product[];
  memos: CashMemo[];
  customers: Customer[];
}

// Helper to extract customers from initial memos
function extractInitialCustomers(memos: CashMemo[]): Customer[] {
  const map = new Map<string, Customer>();
  memos.forEach((m, idx) => {
    const name = (m.customerName || '').trim();
    const phone = (m.customerPhone || '').trim();
    if (name && name !== 'খুচরা ক্রেতা' && phone) {
      if (!map.has(phone)) {
        map.set(phone, {
          id: `cust-${idx + 1}`,
          name,
          phone,
          address: m.customerAddress || '',
          totalMemos: 1,
          totalSpent: m.totalAmount || 0,
          createdAt: m.createdAt || new Date().toISOString(),
        });
      } else {
        const c = map.get(phone)!;
        c.totalMemos = (c.totalMemos || 0) + 1;
        c.totalSpent = (c.totalSpent || 0) + (m.totalAmount || 0);
      }
    }
  });
  return Array.from(map.values());
}

let dbState: LocalDB = {
  settings: initialShopSettings,
  products: initialProducts,
  memos: initialMemos,
  customers: extractInitialCustomers(initialMemos),
};

// Initialize JSON database
function initDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(fileContent);
      const loadedProducts: Product[] = parsed.products || initialProducts;
      const enrichedProducts = loadedProducts.map((p) => {
        const initMatch = initialProducts.find((ip) => ip.id === p.id || ip.code === p.code || ip.name === p.name);
        if (initMatch && initMatch.variants && (!p.variants || p.variants.length === 0)) {
          return { ...p, variants: initMatch.variants };
        }
        return p;
      });
      const loadedCustomers: Customer[] = (parsed.customers && parsed.customers.length > 0)
        ? parsed.customers
        : extractInitialCustomers(parsed.memos || initialMemos);
      dbState = {
        settings: parsed.settings || initialShopSettings,
        products: enrichedProducts,
        memos: parsed.memos || initialMemos,
        customers: loadedCustomers,
      };

      // Check and repair any duplicate memo numbers in loaded memos
      const prefix = dbState.settings.invoicePrefix || 'MEMO-';
      const repairResult = repairDuplicateMemos(dbState.memos, prefix);
      if (repairResult.changed) {
        console.log(`[DB] Auto-repaired ${repairResult.repairedCount} duplicate memo numbers.`);
        dbState.memos = repairResult.memos;
      }

      // Ensure nextMemoNumber is strictly higher than any existing memo number
      const nextAvailable = getNextAvailableMemoNumber(dbState.memos, dbState.settings);
      if ((dbState.settings.nextMemoNumber || 0) < nextAvailable.nextNumber - 1) {
        dbState.settings.nextMemoNumber = nextAvailable.nextNumber - 1;
      }

      if (repairResult.changed) {
        saveDB();
      }
    } else {
      saveDB();
    }
  } catch (err) {
    console.warn('Database initialization warning, running in memory:', err);
  }
}

function saveDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB to disk:', err);
  }
}

initDB();

// API ROUTES

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Settings API
app.get('/api/settings', (_req, res) => {
  res.json(dbState.settings);
});

app.post('/api/settings', (req, res) => {
  dbState.settings = { ...dbState.settings, ...req.body };
  saveDB();
  res.json(dbState.settings);
});

// Products API
app.get('/api/products', (_req, res) => {
  res.json(dbState.products);
});

app.post('/api/products', (req, res) => {
  let productCode = (req.body.code || '').trim();
  if (!productCode) {
    let maxNum = 1000;
    dbState.products.forEach((p) => {
      if (p.code) {
        const matches = p.code.match(/\d+/g);
        if (matches) {
          matches.forEach((m) => {
            const num = parseInt(m, 10);
            if (!isNaN(num) && num >= 100 && num < 999999) {
              if (num > maxNum) maxNum = num;
            }
          });
        }
      }
    });
    productCode = `SKU-${maxNum + 1}`;
  }

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    name: req.body.name || 'নতুন পণ্য',
    code: productCode,
    price: Number(req.body.price) || 0,
    unit: req.body.unit || 'পিস',
    category: req.body.category || 'সাধারণ',
    stock: Number(req.body.stock) || 100,
  };
  dbState.products.unshift(newProduct);
  saveDB();
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const index = dbState.products.findIndex((p) => p.id === id);
  if (index !== -1) {
    dbState.products[index] = { ...dbState.products[index], ...req.body };
    saveDB();
    res.json(dbState.products[index]);
  } else {
    res.status(404).json({ error: 'পণ্য পাওয়া যায়নি' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  dbState.products = dbState.products.filter((p) => p.id !== id);
  saveDB();
  res.json({ success: true, id });
});

// Memos API
app.get('/api/memos', (req, res) => {
  const { date, search } = req.query;
  let result = [...dbState.memos];

  if (date && typeof date === 'string') {
    result = result.filter((m) => m.date === date);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    result = result.filter(
      (m) =>
        m.memoNo.toLowerCase().includes(q) ||
        m.customerName.toLowerCase().includes(q) ||
        m.customerPhone.toLowerCase().includes(q)
    );
  }

  // Sort newest first
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(result);
});

// Get next available auto memo number
app.get('/api/memos/next-number', (_req, res) => {
  const nextInfo = getNextAvailableMemoNumber(dbState.memos, dbState.settings);
  res.json({
    memoNo: nextInfo.memoNo,
    nextNumber: nextInfo.nextNumber,
    prefix: dbState.settings.invoicePrefix || 'MEMO-',
  });
});

// Repair any existing duplicate memo numbers
app.post('/api/memos/repair-numbers', (_req, res) => {
  const prefix = dbState.settings.invoicePrefix || 'MEMO-';
  const result = repairDuplicateMemos(dbState.memos, prefix);
  if (result.changed) {
    dbState.memos = result.memos;
    const nextInfo = getNextAvailableMemoNumber(dbState.memos, dbState.settings);
    dbState.settings.nextMemoNumber = Math.max(dbState.settings.nextMemoNumber || 1001, nextInfo.nextNumber - 1);
    saveDB();
  }
  res.json({
    success: true,
    repairedCount: result.repairedCount,
    memos: dbState.memos,
    settings: dbState.settings,
  });
});

app.post('/api/memos', (req, res) => {
  const memoData = req.body;
  const rawMemoNo = (memoData.memoNo || '').trim();

  // Check if requested memo number is already taken by an existing memo
  const isDuplicate = rawMemoNo && dbState.memos.some(
    (m) => m.memoNo && m.memoNo.trim().toUpperCase() === rawMemoNo.toUpperCase()
  );

  let finalMemoNo = rawMemoNo;
  if (!rawMemoNo || isDuplicate) {
    const nextInfo = getNextAvailableMemoNumber(dbState.memos, dbState.settings);
    finalMemoNo = nextInfo.memoNo;
  }

  const newMemo: CashMemo = {
    ...memoData,
    id: memoData.id || `memo-${Date.now()}`,
    memoNo: finalMemoNo,
    createdAt: memoData.createdAt || new Date().toISOString(),
  };

  dbState.memos.unshift(newMemo);

  // Increment and ensure nextMemoNumber is strictly higher than any existing memo
  const prefix = dbState.settings.invoicePrefix || 'MEMO-';
  const extractedNum = extractMemoNumber(finalMemoNo, prefix);
  const nextInfo = getNextAvailableMemoNumber(dbState.memos, dbState.settings);
  dbState.settings.nextMemoNumber = Math.max(
    dbState.settings.nextMemoNumber || 1001,
    (extractedNum !== null ? extractedNum + 1 : 1001),
    nextInfo.nextNumber - 1
  );

  // Update stock for purchased products if matched
  if (Array.isArray(newMemo.items)) {
    newMemo.items.forEach((item) => {
      if (item.productId) {
        const prod = dbState.products.find((p) => p.id === item.productId);
        if (prod && typeof prod.stock === 'number') {
          prod.stock = Math.max(0, prod.stock - item.quantity);
        }
      }
    });
  }

  // Auto-record customer into customers list if valid name & phone
  const custName = (newMemo.customerName || '').trim();
  const custPhone = (newMemo.customerPhone || '').trim();
  if (custName && custName !== 'খুচরা ক্রেতা' && custPhone) {
    if (!dbState.customers) dbState.customers = [];
    const existingIdx = dbState.customers.findIndex((c) => c.phone.trim() === custPhone);
    if (existingIdx !== -1) {
      dbState.customers[existingIdx] = {
        ...dbState.customers[existingIdx],
        name: custName,
        address: newMemo.customerAddress || dbState.customers[existingIdx].address || '',
        totalMemos: (dbState.customers[existingIdx].totalMemos || 0) + 1,
        totalSpent: (dbState.customers[existingIdx].totalSpent || 0) + (newMemo.totalAmount || 0),
      };
    } else {
      dbState.customers.unshift({
        id: `cust-${Date.now()}`,
        name: custName,
        phone: custPhone,
        address: newMemo.customerAddress || '',
        totalMemos: 1,
        totalSpent: newMemo.totalAmount || 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  saveDB();
  res.status(201).json({ memo: newMemo, settings: dbState.settings });
});

// Customers API
app.get('/api/customers', (_req, res) => {
  res.json(dbState.customers || []);
});

app.post('/api/customers', (req, res) => {
  const customerData = req.body;
  if (!customerData.name || !customerData.phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  if (!dbState.customers) dbState.customers = [];
  const existingIdx = dbState.customers.findIndex(
    (c) => c.phone.trim() === customerData.phone.trim() || (customerData.id && c.id === customerData.id)
  );

  let savedCustomer: Customer;
  if (existingIdx !== -1) {
    dbState.customers[existingIdx] = {
      ...dbState.customers[existingIdx],
      ...customerData,
      id: dbState.customers[existingIdx].id,
    };
    savedCustomer = dbState.customers[existingIdx];
  } else {
    savedCustomer = {
      id: customerData.id || `cust-${Date.now()}`,
      name: customerData.name.trim(),
      phone: customerData.phone.trim(),
      address: customerData.address?.trim() || '',
      note: customerData.note?.trim() || '',
      totalMemos: customerData.totalMemos || 0,
      totalSpent: customerData.totalSpent || 0,
      createdAt: customerData.createdAt || new Date().toISOString(),
    };
    dbState.customers.unshift(savedCustomer);
  }

  saveDB();
  res.status(201).json(savedCustomer);
});

app.delete('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  if (dbState.customers) {
    dbState.customers = dbState.customers.filter((c) => c.id !== id);
  }
  saveDB();
  res.json({ success: true, id });
});

app.put('/api/memos/:id', (req, res) => {
  const { id } = req.params;
  const index = dbState.memos.findIndex((m) => m.id === id);
  if (index !== -1) {
    dbState.memos[index] = { ...dbState.memos[index], ...req.body };
    saveDB();
    res.json(dbState.memos[index]);
  } else {
    res.status(404).json({ error: 'মেমো পাওয়া যায়নি' });
  }
});

app.delete('/api/memos/:id', (req, res) => {
  const { id } = req.params;
  dbState.memos = dbState.memos.filter((m) => m.id !== id);
  saveDB();
  res.json({ success: true, id });
});

app.post('/api/memos/clear-all', (_req, res) => {
  dbState.memos = [];
  saveDB();
  res.json({ success: true, count: 0 });
});

// Daily Summary API
app.get('/api/summary', (req, res) => {
  const targetDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const daysMemos = dbState.memos.filter((m) => m.date === targetDate);

  const totalSalesAmount = daysMemos.reduce((sum, m) => sum + m.totalAmount, 0);
  const totalPaidAmount = daysMemos.reduce((sum, m) => sum + m.paidAmount, 0);
  const totalDueAmount = daysMemos.reduce((sum, m) => sum + m.dueAmount, 0);

  const cashPaid = daysMemos
    .filter((m) => m.paymentMethod === 'Cash')
    .reduce((sum, m) => sum + m.paidAmount, 0);

  const mobileBankingPaid = daysMemos
    .filter((m) => ['bKash', 'Nagad', 'Rocket'].includes(m.paymentMethod))
    .reduce((sum, m) => sum + m.paidAmount, 0);

  const cardPaid = daysMemos
    .filter((m) => ['Card', 'Bank'].includes(m.paymentMethod))
    .reduce((sum, m) => sum + m.paidAmount, 0);

  res.json({
    date: targetDate,
    totalMemos: daysMemos.length,
    totalSalesAmount,
    totalPaidAmount,
    totalDueAmount,
    cashPaid,
    mobileBankingPaid,
    cardPaid,
  });
});

// Full Backup & Restore APIs
app.get('/api/backup', (_req, res) => {
  res.json({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    settings: dbState.settings,
    products: dbState.products,
    memos: dbState.memos,
    customers: dbState.customers || [],
  });
});

app.post('/api/restore', (req, res) => {
  try {
    const { settings, products, memos, customers } = req.body;
    if (settings) dbState.settings = settings;
    if (Array.isArray(products)) dbState.products = products;
    if (Array.isArray(memos)) dbState.memos = memos;
    if (Array.isArray(customers)) dbState.customers = customers;
    saveDB();
    res.json({
      success: true,
      message: 'Data restored successfully',
      settings: dbState.settings,
      products: dbState.products,
      memos: dbState.memos,
      customers: dbState.customers,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid backup data' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sales Cash Memo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
