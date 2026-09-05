import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth, type UserRole } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { AppShell } from './components/layout/AppShell';

// Merchant Views
import { MerchantOverview } from './views/merchant/MerchantOverview';
import { MerchantProducts } from './views/merchant/MerchantProducts';
import { MerchantOrders } from './views/merchant/MerchantOrders';
import { MerchantGrowth } from './views/merchant/MerchantGrowth';
import { MerchantPolicies } from './views/merchant/MerchantPolicies';
import { MerchantManifest } from './views/merchant/MerchantManifest';
import { MerchantLedger } from './views/merchant/MerchantLedger';
import { MerchantSettings } from './views/merchant/MerchantSettings';

// Buyer Views
import { BuyerShopping } from './views/buyer/BuyerShopping';
import { BuyerCatalog } from './views/buyer/BuyerCatalog';
import { BuyerOrders } from './views/buyer/BuyerOrders';
import { BuyerPolicies } from './views/buyer/BuyerPolicies';
import { BuyerActivity } from './views/buyer/BuyerActivity';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000';

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

interface CartItem {
  product_id: string;
  variant_id?: string;
  product_name: string;
  unit_price_paise: number;
  quantity: number;
  subtotal_paise: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal_paise: number;
  total_paise: number;
}

interface Order {
  id: string;
  buyer_id: string;
  merchant_id: string;
  status: string;
  items: CartItem[];
  total_paise: number;
  currency: string;
  created_at: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  conversation_id: string;
  actor: string;
  event_type: string;
  title: string;
  description: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILURE' | 'INFO';
  metadata?: any;
}

interface AgentAction {
  id: string;
  conversation_id: string;
  agent_id: string;
  action_type: string;
  summary: string;
  inputs: any;
  result: any;
  policy_verdict?: string;
  timestamp: string;
}

interface Policy {
  id: string;
  buyer_id: string;
  max_transaction_paise: number;
  daily_spend_limit_paise: number;
  require_confirmation_above_paise: number;
  allowed_categories: string[];
}

interface Analytics {
  totalRevenuePaise: number;
  totalOrders: number;
  aiGeneratedOrders: number;
  averageOrderValuePaise: number;
  upsellRevenuePaise: number;
  failedTransactions: number;
  conversionRate: number;
}

export default function App() {
  const { user, authFetch } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalRole, setAuthModalRole] = useState<UserRole>('BUYER');
  const [activeTab, setActiveTab] = useState<string>('chat');

  const [merchantStats, setMerchantStats] = useState<{
    total_orders: number;
    total_revenue_paise: number;
    total_products: number;
    low_stock_items: number;
    recent_orders: any[];
  } | null>(null);

  // Chat State
  const [messages, setMessages] = useState<
    Array<{ sender: 'user' | 'agent' | 'system'; text: string; action_type?: string; policy_verdict?: string; timestamp: string }>
  >([
    {
      sender: 'agent',
      text: "[WELCOME] Hello! I am your **Autonomous AI Buyer Agent**.\n\nType any item or keyword you're looking for (e.g. *hydration vest*, *salomon flask*, *socks*, *running shoes*), and I will search the merchant catalog in real-time and negotiate the best price for you.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([
    'Find hydration vest',
    'Show running shoes',
    'Nike socks',
    'Electrolyte mix',
  ]);
  const [conversationId] = useState<string>(() => 'conv_' + Math.random().toString(36).substring(2, 9));

  // Commerce & System States
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [todaySpent, setTodaySpent] = useState<number>(0);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const [manifest, setManifest] = useState<any>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);

  // Ledger Verification & Tamper Simulation
  const [ledgerVerification, setLedgerVerification] = useState<{ isValid: boolean; reason?: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Active Cart in Chat
  const [activeCart, setActiveCart] = useState<Cart | null>(null);

  // Switch default tab when role changes
  useEffect(() => {
    if (user?.role === 'MERCHANT') {
      setActiveTab('overview');
    } else if (user?.role === 'BUYER') {
      setActiveTab('chat');
    }
    fetchAllData();
  }, [user]);

  // Initialize Socket.IO & Data Fetching
  useEffect(() => {
    fetchAllData();

    const socket = io(API_BASE);

    socket.on('audit:event', (event: AuditEvent) => {
      setAuditEvents((prev) => [event, ...prev]);
    });

    socket.on('agent:action', (action: AgentAction) => {
      setAgentActions((prev) => [action, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchAllData = () => {
    fetchProducts();
    fetchOrders();
    fetchAnalytics();
    fetchPolicy();
    fetchActiveCart();
    fetchMerchantStats();
    fetchAuditEvents();
    fetchAgentActions();
    fetchManifest();
    fetchDemoStatus();
  };

  const fetchActiveCart = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/cart/active`);
      if (res.ok) {
        const cart = await res.json();
        setActiveCart(cart);
      }
    } catch (err) {
      console.error('Error fetching active cart', err);
    }
  };

  const fetchMerchantStats = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/merchant/dashboard/stats`);
      if (res.ok) {
        const data = await res.json();
        setMerchantStats(data);
      }
    } catch (err) {
      console.error('Error fetching merchant stats', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/catalog/products`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Error fetching products', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/orders`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Error fetching orders', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/analytics`);
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics', err);
    }
  };

  const fetchPolicy = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/policies`);
      const data = await res.json();
      setPolicy(data.policy);
      setTodaySpent(data.today_spent_paise || 0);
    } catch (err) {
      console.error('Error fetching policy', err);
    }
  };

  const fetchAuditEvents = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/audit/events`);
      const data = await res.json();
      setAuditEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching audit events', err);
    }
  };

  const fetchAgentActions = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/audit/actions`);
      const data = await res.json();
      setAgentActions(data.actions || []);
    } catch (err) {
      console.error('Error fetching agent actions', err);
    }
  };

  const fetchManifest = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/merchants/mch_urbanfit_001/agent-manifest`);
      const data = await res.json();
      setManifest(data);
    } catch (err) {
      console.error('Error fetching manifest', err);
    }
  };

  const fetchDemoStatus = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/demo/status`);
      const data = await res.json();
      setSimulateFailure(data.simulate_failure);
    } catch (err) {
      console.error('Error fetching demo status', err);
    }
  };

  const toggleFailureMode = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/demo/toggle-failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !simulateFailure }),
      });
      const data = await res.json();
      setSimulateFailure(data.simulate_failure);
    } catch (err) {
      console.error('Error toggling failure mode', err);
    }
  };

  const verifyLedger = async () => {
    setIsVerifying(true);
    try {
      const res = await authFetch(`${API_BASE}/api/ledger/verify`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setLedgerVerification({ isValid: true });
      } else {
        setLedgerVerification({ isValid: false, reason: data.error || 'Tampering detected' });
      }
    } catch (err: any) {
      setLedgerVerification({ isValid: false, reason: err.message });
    } finally {
      setIsVerifying(false);
      setTimeout(() => setLedgerVerification(null), 5000);
    }
  };

  const tamperLedger = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/ledger/tamper`, { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Block hash modified maliciously in SQLite. Click "Verify Ledger" to inspect!');
      verifyLedger();
    } catch (err: any) {
      console.error('Tamper failed', err);
    }
  };

  const repairLedger = async () => {
    setIsVerifying(true);
    try {
      const res = await authFetch(`${API_BASE}/api/ledger/repair`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setLedgerVerification({ isValid: true });
        alert(data.message || 'Ledger hash chain repaired successfully!');
      } else {
        alert(data.error || 'Failed to repair ledger');
      }
    } catch (err: any) {
      console.error('Repair failed', err);
    } finally {
      setIsVerifying(false);
      setTimeout(() => setLedgerVerification(null), 5000);
    }
  };

  const handleCreateProduct = async (productForm: any) => {
    try {
      const res = await authFetch(`${API_BASE}/api/catalog/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productForm.name.trim(),
          category: productForm.category,
          description: productForm.description.trim(),
          price_inr: Number(productForm.price_inr),
          tags: productForm.tags,
          initial_stock: Number(productForm.initial_stock) || 25,
          sku: productForm.sku || undefined,
          image_url: productForm.image_url || undefined,
          policies: {
            max_concession_percent: Number(productForm.max_concession_percent) || 15,
            autonomous_checkout: productForm.autonomous_checkout,
            requires_reservation: productForm.requires_reservation,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchProducts();
        await fetchMerchantStats();
        return true;
      } else {
        alert(data.error || 'Failed to create product');
        return false;
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
      return false;
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to remove this product from inventory?')) return;
    try {
      const res = await authFetch(`${API_BASE}/api/catalog/products/${productId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await fetchProducts();
        await fetchMerchantStats();
      } else {
        alert(data.error || data.message || 'Failed to delete product');
      }
    } catch (err) {
      console.error('Failed to delete product', err);
    }
  };

  const handleUpdatePolicy = async (updated: Policy) => {
    try {
      const res = await authFetch(`${API_BASE}/api/policies`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setPolicy(updated);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update policy');
      }
    } catch (err: any) {
      console.error('Policy update error', err);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const text = customText || inputText;
    if (!text.trim() || isProcessing) return;

    const userMsg = {
      sender: 'user' as const,
      text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      const res = await authFetch(`${API_BASE}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
        }),
      });

      const data = await res.json();

      if (data.context?.cart) {
        setActiveCart(data.context.cart);
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: data.reply,
          action_type: data.action_type,
          policy_verdict: data.policy_verdict,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      if (data.quick_replies) {
        setQuickReplies(data.quick_replies);
      }

      // Refresh system data in background
      fetchActiveCart();
      fetchOrders();
      fetchAnalytics();
      fetchMerchantStats();
      fetchPolicy();
      fetchAuditEvents();
      fetchAgentActions();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `[Error] Error processing request: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAskAgentToBuy = (productName: string) => {
    setActiveTab('chat');
    handleSendMessage(`I want to buy ${productName}`);
  };

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab)}
      simulateFailure={simulateFailure}
      onToggleFailure={toggleFailureMode}
      onVerifyLedger={verifyLedger}
      onTamperLedger={tamperLedger}
      onRepairLedger={repairLedger}
      isVerifying={isVerifying}
      ledgerVerification={ledgerVerification}
      onOpenAuth={() => {
        setAuthModalRole(user?.role || 'BUYER');
        setShowAuthModal(true);
      }}
    >
      {/* MERCHANT PORTAL VIEWS */}
      {user?.role === 'MERCHANT' && (
        <>
          {activeTab === 'overview' && (
            <MerchantOverview
              merchantStats={merchantStats}
              analytics={analytics}
              productsCount={products.length}
              orders={orders}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'catalog' && (
            <MerchantProducts
              products={products}
              onDeleteProduct={handleDeleteProduct}
              onCreateProduct={handleCreateProduct}
              onAskAgent={handleAskAgentToBuy}
              apiBase={API_BASE}
            />
          )}

          {activeTab === 'orders' && (
            <MerchantOrders orders={orders} onRefreshOrders={fetchOrders} />
          )}

          {activeTab === 'growth' && (
            <MerchantGrowth
              productsCount={products.length}
              totalOrders={orders.length}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'policies' && (
            <MerchantPolicies
              products={products}
              onNavigateProducts={() => setActiveTab('catalog')}
            />
          )}

          {activeTab === 'manifest' && (
            <MerchantManifest manifest={manifest} apiBase={API_BASE} />
          )}

          {activeTab === 'audit' && (
            <MerchantLedger
              auditEvents={auditEvents}
              onVerifyLedger={verifyLedger}
              onTamperLedger={tamperLedger}
              onRepairLedger={repairLedger}
              isVerifying={isVerifying}
              ledgerVerification={ledgerVerification}
            />
          )}

          {activeTab === 'settings' && (
            <MerchantSettings
              simulateFailure={simulateFailure}
              onToggleFailure={toggleFailureMode}
              apiBase={API_BASE}
            />
          )}
        </>
      )}

      {/* BUYER PORTAL VIEWS (DEFAULT) */}
      {user?.role !== 'MERCHANT' && (
        <>
          {activeTab === 'chat' && (
            <BuyerShopping
              messages={messages}
              inputText={inputText}
              onInputChange={setInputText}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
              quickReplies={quickReplies}
              conversationId={conversationId}
              activeCart={activeCart}
              policy={policy}
              todaySpent={todaySpent}
              onClearChat={() => setMessages([])}
            />
          )}

          {activeTab === 'catalog' && (
            <BuyerCatalog
              products={products}
              onAskAgentToBuy={handleAskAgentToBuy}
            />
          )}

          {activeTab === 'orders' && (
            <BuyerOrders
              orders={orders}
              onStartShopping={() => setActiveTab('chat')}
            />
          )}

          {activeTab === 'policies' && (
            <BuyerPolicies
              policy={policy}
              todaySpent={todaySpent}
              onUpdatePolicy={handleUpdatePolicy}
            />
          )}

          {activeTab === 'activity' && (
            <BuyerActivity agentActions={agentActions} />
          )}

          {activeTab === 'audit' && (
            <MerchantLedger
              auditEvents={auditEvents}
              onVerifyLedger={verifyLedger}
              onTamperLedger={tamperLedger}
              onRepairLedger={repairLedger}
              isVerifying={isVerifying}
              ledgerVerification={ledgerVerification}
            />
          )}
        </>
      )}

      {/* ROLE AUTHENTICATION MODAL */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultRole={authModalRole}
      />
    </AppShell>
  );
}
