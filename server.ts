import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initialShopSettings, initialProducts, initialMemos } from './src/data/initialData';
import { CashMemo, Product, ShopSettings } from './src/types';

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
}

let dbState: LocalDB = {
  settings: initialShopSettings,
  products: initialProducts,
  memos: initialMemos,
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
      dbState = {
        settings: parsed.settings || initialShopSettings,
        products: parsed.products || initialProducts,
        memos: parsed.memos || initialMemos,
      };
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
  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    name: req.body.name || 'নতুন পণ্য',
    code: req.body.code || '',
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

app.post('/api/memos', (req, res) => {
  const memoData = req.body;
  const memoNo = memoData.memoNo || `${dbState.settings.invoicePrefix}${dbState.settings.nextMemoNumber}`;

  const newMemo: CashMemo = {
    ...memoData,
    id: `memo-${Date.now()}`,
    memoNo,
    createdAt: new Date().toISOString(),
  };

  dbState.memos.unshift(newMemo);

  // Increment memo number counter in settings
  dbState.settings.nextMemoNumber = (dbState.settings.nextMemoNumber || 1000) + 1;

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

  saveDB();
  res.status(201).json({ memo: newMemo, settings: dbState.settings });
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
  });
});

app.post('/api/restore', (req, res) => {
  try {
    const { settings, products, memos } = req.body;
    if (settings) dbState.settings = settings;
    if (Array.isArray(products)) dbState.products = products;
    if (Array.isArray(memos)) dbState.memos = memos;
    saveDB();
    res.json({
      success: true,
      message: 'Data restored successfully',
      settings: dbState.settings,
      products: dbState.products,
      memos: dbState.memos,
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
