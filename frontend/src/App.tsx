import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Bot, Shield, ShieldAlert, Activity, Cpu } from 'lucide-react';
import './index.css';

// --- Components ---

function LiveFeed({ socket }: { socket: Socket | null }) {
  const [feed, setFeed] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;
    
    const handler = (type: string) => (data: any) => {
      setFeed(prev => [{ _id: Math.random().toString(), type, ...data }, ...prev].slice(0, 50));
    };

    socket.on('tasks', handler('task'));
    socket.on('bids', handler('bid'));
    socket.on('awards', handler('award'));
    socket.on('results', handler('result'));

    return () => {
      socket.off('tasks');
      socket.off('bids');
      socket.off('awards');
      socket.off('results');
    };
  }, [socket]);

  return (
    <div className="glass-panel" style={{ gridRow: 'span 2' }}>
      <h2 className="title" style={{ fontSize: '1.5rem' }}>
        <Activity size={24} style={{ display: 'inline', marginRight: '8px' }} />
        Live Event Stream
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {feed.map(item => (
          <div key={item._id} className={`feed-item ${item.type}`}>
            <div className="feed-meta">
              <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{item.type}</span>
              <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              {item.type === 'task' && `Broadcast: ${item.task_id} (Budget: ${item.max_budget})`}
              {item.type === 'bid' && `Bot ${item.bot_id} bid ${item.amount}`}
              {item.type === 'award' && `🏆 ${item.winning_bot_id} won ${item.task_id} for ${item.winning_amount}`}
              {item.type === 'result' && `Result published by ${item.bot_id}`}
            </div>
          </div>
        ))}
        {feed.length === 0 && <div className="subtitle">Waiting for events...</div>}
      </div>
    </div>
  );
}

function BotRoster({ socket }: { socket: Socket | null }) {
  const [bots, setBots] = useState<any[]>([]);
  const [botHealth, setBotHealth] = useState<Record<string, string>>({});

  const fetchBots = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/bots');
      const data = await res.json();
      setBots(data.bots);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBots();
    const interval = setInterval(fetchBots, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      setBotHealth(prev => ({ ...prev, [data.bot_id]: data.status }));
    };
    socket.on('bot_status', handler);
    return () => { socket.off('bot_status', handler); };
  }, [socket]);

  return (
    <div className="glass-panel">
      <h2 className="title" style={{ fontSize: '1.5rem' }}>
        <Cpu size={24} style={{ display: 'inline', marginRight: '8px' }} />
        Swarm Roster
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {bots.map(b => (
          <div key={b.id} className="bot-row" style={{ opacity: botHealth[b.id] === 'DEGRADED' ? 0.5 : 1 }}>
            <div className="bot-name">
              <Bot size={18} color={botHealth[b.id] === 'DEGRADED' ? 'var(--danger-color)' : 'var(--text-secondary)'} />
              {b.id}
              {botHealth[b.id] === 'DEGRADED' && (
                <span className="type-badge" style={{ backgroundColor: 'rgba(255, 76, 76, 0.2)', color: 'var(--danger-color)', marginLeft: '8px' }}>
                  DEGRADED
                </span>
              )}
            </div>
            <div className="bot-balance">{b.balance} 🪙</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LedgerView() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const fetchLedger = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/ledger?limit=20');
      const data = await res.json();
      setLedger(data.data.reverse()); // Show newest at top if we fetched desc, wait api is ASC, we want descending.
    } catch (e) {
      console.error(e);
    }
  };

  const verifyLedger = async () => {
    try {
      setStatus('idle');
      const res = await fetch('http://localhost:4000/api/ledger/verify', { method: 'POST' });
      if (res.ok) setStatus('valid');
      else setStatus('invalid');
    } catch (e) {
      setStatus('invalid');
    }
  };

  const tamperLedger = async () => {
    try {
      await fetch('http://localhost:4000/api/ledger/tamper', { method: 'POST' });
      // Fetch will automatically show the tampered hash
      fetchLedger();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLedger();
    const interval = setInterval(fetchLedger, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="title" style={{ fontSize: '1.5rem', margin: 0 }}>
          <Shield size={24} style={{ display: 'inline', marginRight: '8px' }} />
          Immutable Ledger
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className={`status-indicator ${status !== 'idle' ? status : ''}`} />
          <button className="btn btn-accent" onClick={verifyLedger} style={{ fontSize: '0.8rem' }}>
            Verify Chain
          </button>
          <button className="btn btn-danger" onClick={tamperLedger} title="Force Tamper (Demo)">
            <ShieldAlert size={16} />
          </button>
        </div>
      </div>
      
      <div className="ledger-list">
        {/* We reverse to show newest on top manually since API returns ASC LIMIT OFFSET. Actually best to reverse `ledger` array. */}
        {[...ledger].reverse().map(entry => (
          <div key={entry.id} className="ledger-item">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="type-badge">{entry.type}</span>
              <span style={{ color: 'var(--accent-color)' }}>{entry.amount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              <span>{entry.from_bot_id} → {entry.to_bot_id}</span>
            </div>
            <div className="hash-truncate" title={entry.hash}>
              Hash: {entry.hash}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Razorpay Gateway ---
declare var window: any;

function PaymentGateway() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const initiatePayment = async (action: 'FUND_ESCROW' | 'SETTLE_PAYMENT') => {
    try {
      setLoading(true);
      setError('');
      const amount = parseInt(window.prompt('Enter amount to process:', '100'));
      const taskId = window.prompt('Enter Task ID to associate:', 'task_demo_1');
      if (!amount || !taskId) return;

      const orderRes = await fetch('http://localhost:4000/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "BotBot Marketplace",
        description: action === 'FUND_ESCROW' ? "Fund Task Escrow" : "Settle Bot Payment",
        order_id: orderData.order_id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('http://localhost:4000/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...response,
                task_id: taskId,
                bot_id: 'worker_1', // default for demo
                amount: amount,
                action
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');
            alert('✅ Payment verified securely by backend!');
          } catch (err: any) {
            setError(err.message);
            alert(`🚨 Payment verification failed: ${err.message}`);
          }
        },
        theme: { color: "#66fcf1" }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        setError(`Payment Failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
      <h2 className="title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
        <Shield size={20} style={{ display: 'inline', marginRight: '8px' }} />
        Fiat Gateway (Human Gated)
      </h2>
      <p className="subtitle" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
        Real funds are never moved autonomously. A judge must authorize fiat transactions via Razorpay.
      </p>
      {error && <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-accent" onClick={() => initiatePayment('FUND_ESCROW')} disabled={loading} style={{ flex: 1 }}>
          Fund Escrow
        </button>
        <button className="btn" onClick={() => initiatePayment('SETTLE_PAYMENT')} disabled={loading} style={{ flex: 1 }}>
          Settle Payment
        </button>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io('http://localhost:4000');
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  return (
    <div style={{ padding: '2rem 0' }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 className="title" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>BotBot Marketplace</h1>
        <p className="subtitle">Real-time autonomous agent economy. Powered by Groq & Immutable Ledger.</p>
        <div style={{ marginTop: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
           <div className={`status-indicator ${connected ? 'valid' : 'invalid'}`} /> 
           {connected ? 'Live Stream Connected' : 'Reconnecting to Event Bus...'}
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="main-column">
          <LiveFeed socket={socket} />
        </div>
        <div className="sidebar-column">
          <BotRoster socket={socket} />
          <LedgerView />
          <PaymentGateway />
        </div>
      </div>
    </div>
  );
}
