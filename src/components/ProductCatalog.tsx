import React, { useState } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Tag, Check, AlertCircle } from 'lucide-react';
import { Product, ShopSettings } from '../types';

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
  const [unit, setUnit] = useState('কেজি');
  const [category, setCategory] = useState('খাদ্যপণ্য');
  const [stock, setStock] = useState<number | ''>(100);
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

  const openNewModal = () => {
    setEditingProduct(null);
    setName('');
    setCode('');
    setPrice('');
    setUnit('কেজি');
    setCategory('খাদ্যপণ্য');
    setStock(100);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCode(p.code || '');
    setPrice(p.price);
    setUnit(p.unit);
    setCategory(p.category || 'খাদ্যপণ্য');
    setStock(p.stock || 0);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === '') return;

    if (editingProduct) {
      await onUpdateProduct(editingProduct.id, {
        name,
        code,
        price: Number(price),
        unit,
        category,
        stock: Number(stock) || 0,
      });
    } else {
      await onAddProduct({
        name,
        code,
        price: Number(price),
        unit,
        category,
        stock: Number(stock) || 0,
      });
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
                <th className="p-3.5 text-right">{isBn ? 'একক মূল্য (Price)' : 'Unit Price'}</th>
                <th className="p-3.5 text-center">{isBn ? 'একক (Unit)' : 'Unit'}</th>
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
                    <td className="p-3.5 font-bold text-slate-900">{p.name}</td>
                    <td className="p-3.5 font-mono text-slate-500 text-xs font-semibold">{p.code || '-'}</td>
                    <td className="p-3.5">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-[11px] font-bold border border-slate-200">
                        {p.category || 'সাধারণ'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-emerald-700">
                      {currency} {p.price.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-700">{p.unit}</td>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Package className="w-4 h-4" />
              </span>
              <span>
                {editingProduct
                  ? isBn ? 'পণ্য এডিট করুন' : 'Edit Product'
                  : isBn ? 'নতুন পণ্য যোগ করুন' : 'Add New Product'}
              </span>
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'পণ্যের নাম (Product Name)*' : 'Product Name*'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মিনিকেট চাল 1kg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'একক মূল্য (Price)*' : 'Unit Price*'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'একক (Unit)' : 'Unit'}
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 outline-none font-bold"
                  >
                    <option value="কেজি">কেজি (kg)</option>
                    <option value="গ্রাম">গ্রাম (gm)</option>
                    <option value="লিটার">লিটার (ltr)</option>
                    <option value="পিস">পিস (pc)</option>
                    <option value="প্যাকেট">প্যাকেট (pkt)</option>
                    <option value="ডজন">ডজন (doz)</option>
                    <option value="কার্টন">কার্টন (ctn)</option>
                  </select>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'পণ্য কোড / বারকোড (SKU)' : 'Code / Barcode'}
                </label>
                <input
                  type="text"
                  placeholder="PROD-101"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50 font-medium"
                />
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
