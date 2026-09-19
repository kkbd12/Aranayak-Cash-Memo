import React, { useState } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Tag, Check, AlertCircle, Sparkles, RefreshCw, Layers, X, Scale } from 'lucide-react';
import { Product, ProductVariant, ShopSettings } from '../types';
import { generateAutoSKU } from '../utils/skuGenerator';

interface ProductCatalogProps {
  products: Product[];
  shopSettings: ShopSettings;
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  lang: 'bn' | 'en';
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  shopSettings,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  lang,
}) => {
  const isBn = lang === 'bn';
  const currency = shopSettings.currencySymbol || '৳';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // New Product Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [baseQuantity, setBaseQuantity] = useState<number | ''>(100);
  const [unit, setUnit] = useState('গ্রাম');
  const [category, setCategory] = useState('খাদ্যপণ্য');
  const [stock, setStock] = useState<number | ''>(100);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [pricingMode, setPricingMode] = useState<'single' | 'variants'>('single');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Filter Categories
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category || 'সাধারণ')))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRegenerateSKU = () => {
    const nextSKU = generateAutoSKU(products, category);
    setCode(nextSKU);
  };

  const openNewModal = () => {
    setEditingProduct(null);
    setName('');
    const autoSKU = generateAutoSKU(products, 'খাদ্যপণ্য');
    setCode(autoSKU);
    setPrice('');
    setBaseQuantity(100);
    setUnit('গ্রাম');
    setCategory('খাদ্যপণ্য');
    setStock(100);
    setVariants([]);
    setPricingMode('single');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCode(p.code || generateAutoSKU(products, p.category));
    setPrice(p.price);
    setBaseQuantity(p.baseQuantity || (p.unit === 'গ্রাম' ? 100 : 1));
    setUnit(p.unit || 'গ্রাম');
    setCategory(p.category || 'খাদ্যপণ্য');
    setStock(p.stock || 0);
    const existingVariants = p.variants ? p.variants.map((v) => ({ ...v })) : [];
    setVariants(existingVariants);
    setPricingMode(existingVariants.length > 0 ? 'variants' : 'single');
    setIsModalOpen(true);
  };

  const addVariantRow = (presetName = '', presetUnit = '') => {
    const newV: ProductVariant = {
      id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: presetName,
      price: 0,
      unit: presetUnit || unit || 'গ্রাম',
    };
    setVariants((prev) => [...prev, newV]);
  };

  const updateVariantRow = (id: string, field: keyof ProductVariant, val: any) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: val } : v))
    );
  };

  const removeVariantRow = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Ensure SKU is never empty (auto-generate if user left it blank)
    const finalCode = (code && code.trim()) ? code.trim() : generateAutoSKU(products, category);

    // Sanitize variants
    const validVariants = variants
      .filter((v) => v.name.trim())
      .map((v) => ({
        id: v.id || `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: v.name.trim(),
        price: Number(v.price) || 0,
        unit: v.unit || unit,
      }));

    const finalPrice = Number(price) || 0;
    const finalBaseQty = Number(baseQuantity) || (unit === 'গ্রাম' ? 100 : 1);

    if (price === '' || isNaN(finalPrice) || finalPrice < 0) {
      alert(isBn ? 'অনুগ্রহ করে পণ্যের বিক্রয় মূল্য লিখুন।' : 'Please enter a valid selling price.');
      return;
    }

    const payload = {
      name: name.trim(),
      code: finalCode,
      price: finalPrice,
      baseQuantity: finalBaseQty,
      unit: unit,
      category,
      stock: Number(stock) || 0,
      variants: validVariants,
    };

    if (editingProduct) {
      await onUpdateProduct(editingProduct.id, payload);
    } else {
      await onAddProduct(payload);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner - Bento Header */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold flex items-center gap-2.5">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Package className="w-5 h-5" />
            </span>
            <span>{isBn ? 'পণ্য ও স্টক তালিকা (Product Catalog)' : 'Product & Stock Management'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1.5 font-medium">
            {isBn
              ? 'দোকানের সকল পণ্যের নাম, একক মূল্য ও মজুদ তালিকা এখান থেকে সহজে ক্যাশ মেমোতে ব্যবহৃত হবে।'
              : 'Manage products, preset unit prices, and stock counts for fast invoice creation.'}
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isBn ? 'নতুন পণ্য যোগ করুন' : 'Add New Product'}</span>
        </button>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="bg-white p-4.5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={isBn ? 'পণ্যের নাম বা কোড দিয়ে খুঁজুন...' : 'Search by product name or code...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium bg-slate-50/50"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs font-bold w-full sm:w-auto overflow-x-auto">
          <span className="text-slate-500">{isBn ? 'ক্যাটাগরি:' : 'Category:'}</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 outline-none text-xs font-bold shadow-2xs"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? (isBn ? 'সব ক্যাটাগরি' : 'All Categories') : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product List Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-900 text-white font-extrabold uppercase text-[11px] tracking-wider">
                <th className="p-3.5">{isBn ? 'পণ্যের নাম' : 'Product Name'}</th>
                <th className="p-3.5">{isBn ? 'কোড / SKU' : 'Code'}</th>
                <th className="p-3.5">{isBn ? 'ক্যাটাগরি' : 'Category'}</th>
                <th className="p-3.5 text-right">{isBn ? 'ওজন/পরিমাপ ও বিক্রয় মূল্য' : 'Weight & Selling Price'}</th>
                <th className="p-3.5 text-center">{isBn ? 'মূল একক' : 'Unit'}</th>
                <th className="p-3.5 text-center">{isBn ? 'মজুদ (Stock)' : 'Stock'}</th>
                <th className="p-3.5 text-center">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500 font-bold">
                    {isBn ? 'কোন পণ্য পাওয়া যায়নি।' : 'No products found.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      {p.variants && p.variants.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.variants.map((v) => (
                            <span
                              key={v.id}
                              className="text-[10px] bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                            >
                              <span>{v.name}:</span>
                              <span className="font-mono text-emerald-700">{currency}{v.price}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500 text-xs font-semibold">{p.code || '-'}</td>
                    <td className="p-3.5">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-[11px] font-bold border border-slate-200">
                        {p.category || 'সাধারণ'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="font-mono font-black text-emerald-700 text-sm">
                        {currency} {p.price.toLocaleString()}
                        <span className="text-[11px] text-slate-500 font-normal font-sans ml-1">
                          / {p.baseQuantity && p.baseQuantity > 1 ? `${p.baseQuantity} ${p.unit}` : p.unit}
                        </span>
                      </div>
                      {p.variants && p.variants.length > 0 && (
                        <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md mt-1 border border-emerald-200">
                          {p.variants.length} {isBn ? 'টি ওজন/সাইজ ভ্যারিয়েন্ট' : 'variants'}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-700">
                      {p.baseQuantity && p.baseQuantity > 1 ? `${p.baseQuantity} ${p.unit}` : p.unit}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`font-mono font-black px-2.5 py-1 rounded-full text-xs ${
                          (p.stock || 0) > 20
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : (p.stock || 0) > 0
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {p.stock ?? 0} {p.unit}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
                          title={isBn ? 'এডিট করুন' : 'Edit'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setProductToDelete(p)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                          title={isBn ? 'মুছুন' : 'Delete'}
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

      {/* Add / Edit Product Modal - Bento Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Package className="w-4 h-4" />
                </span>
                <span>
                  {editingProduct
                    ? isBn ? 'পণ্য এডিট করুন' : 'Edit Product'
                    : isBn ? 'নতুন পণ্য যোগ করুন' : 'Add New Product'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'পণ্যের মূল নাম (Product Name)*' : 'Product Name*'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: খাঁটি মধু / সরিষার তেল / মিনিকেট চাল"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
                />
              </div>

              {/* Product Pricing & Weight Section */}
              <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    <span>{isBn ? 'পণ্যের ওজন/পরিমাণ ও বিক্রয় মূল্য নির্ধারণ*' : 'Product Weight/Quantity & Selling Price*'}</span>
                  </label>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    {isBn ? 'ওজন ও মূল্য' : 'Weight & Price'}
                  </span>
                </div>

                {/* 3 Main Fields: Weight/Gram/Quantity + Unit + Selling Price */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* 1. Weight / Gram / Quantity */}
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1 flex items-center justify-between">
                        <span>{isBn ? 'কত গ্রাম / ওজন / পরিমাণ*' : 'Weight / Gram / Qty*'}</span>
                        <span className="text-[10px] text-emerald-700 font-bold">{unit}</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="0.001"
                          step="any"
                          placeholder={unit === 'গ্রাম' ? 'যেমন: ১০০ বা ৫০' : 'যেমন: ১ বা ৫০০'}
                          value={baseQuantity}
                          onChange={(e) => setBaseQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm font-mono font-bold border-2 border-emerald-500 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50/20 text-emerald-950"
                        />
                      </div>
                    </div>

                    {/* 2. Unit of Measure */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        {isBn ? 'পরিমাপের একক*' : 'Unit*'}
                      </label>
                      <select
                        value={unit}
                        onChange={(e) => {
                          const newUnit = e.target.value;
                          setUnit(newUnit);
                          if (newUnit === 'গ্রাম' && (baseQuantity === 1 || !baseQuantity)) {
                            setBaseQuantity(100);
                          } else if (newUnit !== 'গ্রাম' && baseQuantity === 100) {
                            setBaseQuantity(1);
                          }
                        }}
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="গ্রাম">গ্রাম (gm)</option>
                        <option value="কেজি">কেজি (kg)</option>
                        <option value="লিটার">লিটার (ltr)</option>
                        <option value="মিলি">মিলি (ml)</option>
                        <option value="জার">জার (Jar)</option>
                        <option value="বোতল">বোতল (btl)</option>
                        <option value="পিস">পিস (pc)</option>
                        <option value="প্যাকেট">প্যাকেট (pkt)</option>
                        <option value="ডজন">ডজন (doz)</option>
                        <option value="কার্টন">কার্টন (ctn)</option>
                        <option value="বক্স">বক্স (box)</option>
                        <option value="বস্তা">বস্তা (sack)</option>
                      </select>
                    </div>

                    {/* 3. Selling Price */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        {isBn ? 'বিক্রয় মূল্য (Selling Price)*' : 'Selling Price*'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">{currency}</span>
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="যেমন: ৩৫০"
                          value={price}
                          onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Presets for weight & unit */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 mr-1">
                      {isBn ? '⚡ দ্রুত ওজন সিলেক্ট করুন:' : '⚡ Quick Weight:'}
                    </span>
                    {[
                      { qty: 50, u: 'গ্রাম', label: '৫০ গ্রাম' },
                      { qty: 100, u: 'গ্রাম', label: '১০০ গ্রাম' },
                      { qty: 250, u: 'গ্রাম', label: '২৫০ গ্রাম' },
                      { qty: 500, u: 'গ্রাম', label: '৫০০ গ্রাম' },
                      { qty: 1, u: 'কেজি', label: '১ কেজি' },
                      { qty: 1, u: 'লিটার', label: '১ লিটার' },
                      { qty: 1, u: 'জার', label: '১ জার' },
                      { qty: 1, u: 'পিস', label: '১ পিস' },
                      { qty: 1, u: 'প্যাকেট', label: '১ প্যাকেট' },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setBaseQuantity(preset.qty);
                          setUnit(preset.u);
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                          baseQuantity === preset.qty && unit === preset.u
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Live Dynamic Explanation Badge */}
                  <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-950 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">💡</span>
                      <span>
                        {name ? name.trim() : (isBn ? 'পণ্যের' : 'Product')} {baseQuantity || 1} {unit} এর বিক্রয় মূল্য = {currency} {price || 0}
                      </span>
                    </div>
                    {unit === 'গ্রাম' && Number(price) > 0 && Number(baseQuantity) > 0 && (
                      <span className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-800 font-mono text-[11px] self-start sm:self-auto">
                        প্রতি গ্রাম {currency} {((Number(price) / Number(baseQuantity))).toFixed(2)} | প্রতি কেজি {currency} {(((Number(price) / Number(baseQuantity)) * 1000)).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Multiple Variants / Sizes (Optional) */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isBn ? 'অন্যান্য ওজন / সাইজের আলাদা মূল্য (ঐচ্ছিক)' : 'Other Weights / Variants (Optional)'}</span>
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {isBn
                          ? 'যেমন: একই এলাচের ৫০ গ্রাম, ২৫০ গ্রাম, ৫০০ গ্রাম বা ১ কেজির আলাদা দাম যোগ করতে পারেন।'
                          : 'Add different prices for other weights/pack sizes of this item.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addVariantRow('', unit)}
                      className="text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isBn ? '+ ভ্যারিয়েন্ট যোগ করুন' : '+ Add Variant'}</span>
                    </button>
                  </div>

                  {/* Quick Preset Buttons for Variants */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">
                      {isBn ? 'দ্রুত ভ্যারিয়েন্ট যোগ:' : 'Quick Add Variant:'}
                    </span>
                    {[
                      { label: '৫০ গ্রাম', unit: 'গ্রাম' },
                      { label: '১০০ গ্রাম', unit: 'গ্রাম' },
                      { label: '২৫০ গ্রাম', unit: 'গ্রাম' },
                      { label: '৫০০ গ্রাম', unit: 'গ্রাম' },
                      { label: '১ কেজি', unit: 'কেজি' },
                      { label: '১ জার', unit: 'জার' },
                      { label: '১ লিটার', unit: 'লিটার' },
                      { label: '৫০০ মিলি', unit: 'বোতল' },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addVariantRow(preset.label, preset.unit)}
                        className="text-[10px] font-bold bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Variant Rows Table */}
                  {variants.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-12 gap-2 text-[10px] font-extrabold text-slate-500 uppercase px-1">
                        <span className="col-span-5">{isBn ? 'ওজন / সাইজের নাম' : 'Weight / Size'}</span>
                        <span className="col-span-4">{isBn ? 'বিক্রয় মূল্য (৳)' : 'Price (৳)'}</span>
                        <span className="col-span-2">{isBn ? 'একক' : 'Unit'}</span>
                        <span className="col-span-1 text-center">{isBn ? 'মুছুন' : 'Del'}</span>
                      </div>

                      {variants.map((v) => (
                        <div
                          key={v.id}
                          className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200"
                        >
                          <div className="col-span-5">
                            <input
                              type="text"
                              required
                              placeholder="যেমন: ২৫০ গ্রাম"
                              value={v.name}
                              onChange={(e) => updateVariantRow(v.id, 'name', e.target.value)}
                              className="w-full text-xs font-bold px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                            />
                          </div>

                          <div className="col-span-4 relative">
                            <span className="absolute left-2 top-1.5 text-[10px] font-bold text-slate-400">
                              {currency}
                            </span>
                            <input
                              type="number"
                              required
                              min="0"
                              step="any"
                              placeholder="বিক্রয় মূল্য"
                              value={v.price || ''}
                              onChange={(e) =>
                                updateVariantRow(v.id, 'price', e.target.value === '' ? 0 : Number(e.target.value))
                              }
                              className="w-full pl-5 pr-2 py-1.5 text-xs font-mono font-bold border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                            />
                          </div>

                          <div className="col-span-2">
                            <select
                              value={v.unit || unit}
                              onChange={(e) => updateVariantRow(v.id, 'unit', e.target.value)}
                              className="w-full text-xs font-medium px-1.5 py-1.5 border border-slate-200 rounded-lg outline-none bg-white"
                            >
                              <option value="গ্রাম">গ্রাম</option>
                              <option value="কেজি">কেজি</option>
                              <option value="লিটার">লিটার</option>
                              <option value="জার">জার</option>
                              <option value="বোতল">বোতল</option>
                              <option value="পিস">পিস</option>
                              <option value="প্যাকেট">প্যাকেট</option>
                              <option value="ডজন">ডজন</option>
                              <option value="বক্স">বক্স</option>
                            </select>
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => removeVariantRow(v.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'ক্যাটাগরি' : 'Category'}
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'প্রারম্ভিক স্টক (Stock)' : 'Initial Stock'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {isBn ? 'পণ্য কোড / SKU (স্বয়ংক্রিয়)' : 'Product Code / SKU (Auto)'}
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateSKU}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1 transition cursor-pointer"
                    title={isBn ? 'নতুন SKU কোড তৈরি করুন' : 'Generate new SKU'}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{isBn ? 'অটো জেনারেট' : 'Auto Generate'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="যেমন: SKU-1001"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full pl-3.5 pr-20 py-2 text-sm font-mono font-bold border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50/20 text-emerald-950"
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200/80 pointer-events-none flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                    Auto SKU
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  {isBn
                    ? '✨ স্বয়ংক্রিয়ভাবে তৈরি হয়েছে। চাইলে আপনি নিজের মতো কোডও লিখতে পারেন।'
                    : '✨ Auto-generated sequentially. You can also edit it manually.'}
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-emerald-600/20"
                >
                  {isBn ? 'সংরক্ষণ করুন' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Product Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3.5 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100/80">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {isBn ? 'পণ্য মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Product Deletion'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isBn ? 'ক্যাটালগ থেকে এই পণ্যটি স্থায়ীভাবে মুছে যাবে।' : 'This product will be removed from your catalog.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-slate-600">{isBn ? 'পণ্যের নাম:' : 'Product Name:'}</span>
                <span className="text-slate-900 font-extrabold">{productToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{isBn ? 'ক্যাটাগরি:' : 'Category:'}</span>
                <span className="text-slate-700 font-bold">{productToDelete.category || 'সাধারণ'}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/80 pt-2 mt-1 font-bold">
                <span className="text-slate-700">{isBn ? 'একক মূল্য:' : 'Unit Price:'}</span>
                <span className="text-emerald-700 font-mono font-black text-sm">
                  {currency} {productToDelete.price.toLocaleString()} / {productToDelete.unit}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-rose-600/20 flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBn ? 'হ্যাঁ, মুছে ফেলুন' : 'Delete Product'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
