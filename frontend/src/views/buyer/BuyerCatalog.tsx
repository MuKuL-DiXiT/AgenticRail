import React, { useState } from 'react';
import {
  Search,
  Store,
  Bot,
  Image as ImageIcon,
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

interface BuyerCatalogProps {
  products: Product[];
  onAskAgentToBuy: (productName: string) => void;
}

export const BuyerCatalog: React.FC<BuyerCatalogProps> = ({ products, onAskAgentToBuy }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCat = selectedCategory === 'ALL' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
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
          Discover & Browse Catalog
        </h1>
        <p
          style={{
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
            marginTop: '0.2rem',
            margin: 0,
          }}
        >
          Explore items eligible for autonomous agent negotiation and instant checkout
        </p>
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
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '380px',
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
            placeholder="Search items by keywords, sport, or brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="fintech-input"
            style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['ALL', 'footwear', 'apparel', 'gear', 'nutrition'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                border: '1px solid',
                borderColor: selectedCategory === cat ? 'var(--brand-primary)' : 'var(--surface-border)',
                background: selectedCategory === cat ? 'var(--brand-primary-light)' : '#ffffff',
                color: selectedCategory === cat ? 'var(--brand-primary)' : 'var(--text-secondary)',
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

      {/* Products Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {filteredProducts.map((product) => {
          const totalStock = product.variants?.reduce(
            (acc: number, v: any) => acc + (v.stock_quantity || 0),
            0
          ) || 0;

          return (
            <div
              key={product.id}
              className="fintech-card"
              style={{
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div>
                {/* Thumbnail */}
                <div
                  style={{
                    height: '160px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: 'var(--bg-canvas)',
                    position: 'relative',
                    marginBottom: '0.85rem',
                    border: '1px solid var(--surface-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <ImageIcon size={32} color="var(--text-tertiary)" />
                  )}

                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(255, 255, 255, 0.92)',
                      color: 'var(--text-primary)',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      border: '1px solid var(--surface-border)',
                    }}
                  >
                    {product.category}
                  </span>
                </div>

                {/* Title & Price */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {product.name}
                  </h3>
                  <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ₹{((product.price_paise || 0) / 100).toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Description */}
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                    margin: '0.4rem 0 0.75rem',
                  }}
                >
                  {product.description.slice(0, 95)}...
                </p>

                {/* Policy badges */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--brand-primary)',
                      background: 'var(--brand-primary-light)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    ⚡ Negotiable: ≤{product.policies?.max_concession_percent ?? 15}%
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: totalStock > 0 ? 'var(--text-secondary)' : 'var(--error)',
                      background: 'var(--bg-canvas)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    📦 {totalStock > 0 ? `${totalStock} in stock` : 'Out of stock'}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onAskAgentToBuy(product.name)}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.825rem', padding: '0.55rem' }}
              >
                <Bot size={15} /> Ask Agent to Purchase
              </button>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--text-tertiary)',
            }}
          >
            <Store size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <div>No products match your criteria.</div>
          </div>
        )}
      </div>
    </div>
  );
};
