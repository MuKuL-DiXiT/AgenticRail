import React, { useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  price_paise: number;
  image_url?: string;
  policies?: {
    max_concession_percent?: number;
    autonomous_checkout?: boolean;
    requires_reservation?: boolean;
  };
  variants: any[];
}

interface MerchantProductsProps {
  products: Product[];
  onDeleteProduct: (productId: string) => Promise<void>;
  onCreateProduct: (formData: any) => Promise<boolean>;
  onAskAgent?: (productName: string) => void;
  apiBase: string;
}

export const MerchantProducts: React.FC<MerchantProductsProps> = ({
  products,
  onDeleteProduct,
  onCreateProduct,
  onAskAgent,
  apiBase,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    category: 'footwear',
    description: '',
    price_inr: '',
    tags: '',
    initial_stock: 25,
    sku: '',
    image_url: '',
    max_concession_percent: 15,
    autonomous_checkout: true,
    requires_reservation: false,
  });

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCat = categoryFilter === 'ALL' || p.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCat;
  });

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size exceeds 5MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch(`${apiBase}/api/upload/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, folder: 'agentcart/products' }),
        });

        const data = await res.json();
        if (data.url) {
          setForm((prev) => ({ ...prev, image_url: data.url }));
        } else {
          setUploadError(data.error || 'Upload to Cloudinary failed.');
        }
      } catch (err: any) {
        setUploadError(err.message || 'Image upload error.');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim() || !form.price_inr) {
      alert('Please fill in product name, description, and price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onCreateProduct(form);
      if (success) {
        setShowAddModal(false);
        setForm({
          name: '',
          category: 'footwear',
          description: '',
          price_inr: '',
          tags: '',
          initial_stock: 25,
          sku: '',
          image_url: '',
          max_concession_percent: 15,
          autonomous_checkout: true,
          requires_reservation: false,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Products & Inventory
          </h1>
          <p
            style={{
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              marginTop: '0.2rem',
              margin: 0,
            }}
          >
            Manage catalog items, Cloudinary media CDN, and autonomous negotiation margins
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="fintech-card"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '360px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              placeholder="Search products by title, tag, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="fintech-input"
              style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['ALL', 'footwear', 'apparel', 'gear', 'nutrition'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                border: '1px solid',
                borderColor: categoryFilter === cat ? 'var(--brand-primary)' : 'var(--surface-border)',
                background: categoryFilter === cat ? 'var(--brand-primary-light)' : '#ffffff',
                color: categoryFilter === cat ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="fintech-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="fintech-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Image</th>
                <th>Product & SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Agent Concession</th>
                <th>Tags</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const totalStock = product.variants?.reduce(
                  (acc: number, v: any) => acc + (v.stock_quantity || 0),
                  0
                ) || 0;
                const isLow = totalStock > 0 && totalStock < 10;

                return (
                  <tr key={product.id}>
                    <td>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          background: 'var(--bg-canvas)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--surface-border)',
                        }}
                      >
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <ImageIcon size={18} color="var(--text-tertiary)" />
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                        {product.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-tertiary)',
                          fontFamily: 'monospace',
                          marginTop: '0.1rem',
                        }}
                      >
                        {product.variants?.[0]?.sku || product.slug}
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          textTransform: 'capitalize',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-canvas)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          border: '1px solid var(--surface-border)',
                        }}
                      >
                        {product.category}
                      </span>
                    </td>

                    <td className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      ₹{((product.price_paise || 0) / 100).toLocaleString('en-IN')}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="font-mono" style={{ fontWeight: 600 }}>
                          {totalStock}
                        </span>
                        {isLow && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--error)',
                              background: 'var(--error-light)',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            Low
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--brand-primary)',
                            background: 'var(--brand-primary-light)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                        >
                          ≤{product.policies?.max_concession_percent ?? 15}%
                        </span>
                        {product.policies?.requires_reservation && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--warning)',
                              background: 'var(--warning-light)',
                              padding: '0.15rem 0.35rem',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            15m Lock
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', maxWidth: '180px' }}>
                        {(product.tags || []).slice(0, 2).map((t, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-secondary)',
                              background: 'var(--bg-canvas)',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        {onAskAgent && (
                          <button
                            onClick={() => onAskAgent(product.name)}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                          >
                            Ask Agent
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteProduct(product.id)}
                          className="btn btn-secondary"
                          style={{
                            padding: '0.3rem 0.45rem',
                            color: 'var(--error)',
                            borderColor: 'transparent',
                          }}
                          title="Remove product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-tertiary)' }}>
                    No products found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="fintech-card"
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--surface-border)',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Add Merchant Inventory & Autonomous Policies
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                  Index new products into the machine-readable manifest with autonomous pricing boundaries
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
                {/* Left Column: Product Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
                      Product Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Nike Alphafly 3 Proto"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      className="fintech-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
                        Category *
                      </label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="fintech-input"
                      >
                        <option value="footwear">Footwear</option>
                        <option value="apparel">Apparel</option>
                        <option value="gear">Gear & Hydration</option>
                        <option value="nutrition">Sports Nutrition</option>
                        <option value="accessories">Accessories</option>
                        <option value="electronics">Sports Tech</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
                        Price (₹ INR) *
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 4500"
                        value={form.price_inr}
                        onChange={(e) => setForm({ ...form, price_inr: e.target.value })}
                        required
                        min="1"
                        className="fintech-input font-mono"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
                        Initial Stock (Units)
                      </label>
                      <input
                        type="number"
                        placeholder="25"
                        value={form.initial_stock}
                        onChange={(e) => setForm({ ...form, initial_stock: Number(e.target.value) })}
                        min="0"
                        className="fintech-input font-mono"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
                        SKU Code
                      </label>
                      <input
                        type="text"
                        placeholder="NIK-ALP-UK9"
                        value={form.sku}
                        onChange={(e) => setForm({ ...form, sku: e.target.value })}
                        className="fintech-input font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Marathon race shoe with dual Air Zoom pods and carbon fiber plate."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      required
                      className="fintech-input"
                      style={{ height: 'auto', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
                      Tags (Comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="marathon, road, carbon-plate"
                      value={form.tags}
                      onChange={(e) => setForm({ ...form, tags: e.target.value })}
                      className="fintech-input"
                    />
                  </div>
                </div>

                {/* Right Column: Cloudinary Media & Policy Limits */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Image Upload Box */}
                  <div
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '8px',
                      padding: '1rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Upload size={14} color="var(--brand-primary)" /> Cloudinary Media CDN
                    </div>

                    {form.image_url ? (
                      <div
                        style={{
                          position: 'relative',
                          height: '130px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          marginBottom: '0.5rem',
                          border: '1px solid var(--surface-border)',
                        }}
                      >
                        <img
                          src={form.image_url}
                          alt="Product preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, image_url: '' })}
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            background: 'rgba(0,0,0,0.65)',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <X size={14} />
                        </button>
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            left: 6,
                            background: 'var(--success)',
                            color: '#ffffff',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                          }}
                        >
                          CDN Active ✓
                        </span>
                      </div>
                    ) : (
                      <label
                        style={{
                          height: '110px',
                          borderRadius: '6px',
                          border: '2px dashed var(--surface-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          background: '#ffffff',
                          transition: 'border-color 0.2s',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <Upload size={22} color={isUploading ? 'var(--brand-primary)' : 'var(--text-tertiary)'} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                          {isUploading ? 'Uploading to Cloudinary...' : 'Upload Image (PNG, JPG, WEBP)'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          disabled={isUploading}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}

                    {uploadError && (
                      <div style={{ color: 'var(--error)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                        ⚠️ {uploadError}
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                        Or External Image URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={form.image_url}
                        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                        className="fintech-input"
                        style={{ height: '32px', fontSize: '0.75rem' }}
                      />
                    </div>
                  </div>

                  {/* Autonomous Policy Limits */}
                  <div
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '8px',
                      padding: '1rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <ShieldCheck size={15} color="var(--brand-primary)" /> Autonomous Negotiation Policy
                    </div>

                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          Max Concession Floor %
                        </span>
                        <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 700 }}>
                          {form.max_concession_percent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={form.max_concession_percent}
                        onChange={(e) => setForm({ ...form, max_concession_percent: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--brand-primary)' }}
                      />
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                        Merchant agent will negotiate discounts with buyer bots up to this margin.
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={form.autonomous_checkout}
                          onChange={(e) => setForm({ ...form, autonomous_checkout: e.target.checked })}
                          style={{ accentColor: 'var(--brand-primary)' }}
                        />
                        <span>Allow Autonomous Checkout (No Human Prompt)</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={form.requires_reservation}
                          onChange={(e) => setForm({ ...form, requires_reservation: e.target.checked })}
                          style={{ accentColor: 'var(--brand-primary)' }}
                        />
                        <span>Require 15-Minute Inventory Lock</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--surface-border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || isUploading}
                >
                  {isSubmitting ? 'Publishing...' : 'Publish to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
