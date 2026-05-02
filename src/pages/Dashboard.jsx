// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Link } from 'react-router-dom';

// Sum a specific payment mode from paymentSplit or fallback paymentMode
function getModeTotal(docs, mode) {
  return docs.reduce((sum, d) => {
    if (d.paymentSplit?.length > 0) {
      return sum + d.paymentSplit
        .filter((r) => r.mode === mode)
        .reduce((s, r) => s + (r.amount || 0), 0);
    }
    // Legacy: single paymentMode
    return sum + (d.paymentMode === mode ? (d.amount || 0) : 0);
  }, 0);
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'receipts'), orderBy('createdAt', 'desc')));
        const docs = snap.docs.map((d) => d.data());

        const total = docs.reduce((s, d) => s + (d.amount || 0), 0);
        const cash  = getModeTotal(docs, 'Cash');
        const upi   = getModeTotal(docs, 'UPI');
        const bank  = getModeTotal(docs, 'Bank Transfer');

        const todayStr   = new Date().toISOString().slice(0, 10);
        const todayBills = docs.filter((d) => d.date === todayStr);
        const todayTotal = todayBills.reduce((s, d) => s + (d.amount || 0), 0);

        setStats({
          total, cash, upi, bank,
          count: docs.length,
          todayCount: todayBills.length,
          todayTotal,
        });
      } catch {
        setStats({ total: 0, cash: 0, upi: 0, bank: 0, count: 0, todayCount: 0, todayTotal: 0 });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-800 mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-6">Madhurekha Eye Care Centre — OPD Overview</p>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Bills"       value={stats.count}                                        sub="All time" />
            <StatCard label="Total Collection"  value={`₹${stats.total.toLocaleString('en-IN')}`}         sub="All time" />
            <StatCard label="Today's Bills"     value={stats.todayCount}                                   sub="Today" accent />
            <StatCard label="Today's Collection" value={`₹${stats.todayTotal.toLocaleString('en-IN')}`}   sub="Today" accent />
          </div>

          <h2 className="text-sm font-semibold text-slate-700 mb-3">Payment Mode Breakdown</h2>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <ModeCard mode="Cash"          amount={stats.cash} icon="💵" />
            <ModeCard mode="UPI"           amount={stats.upi}  icon="📱" />
            <ModeCard mode="Bank Transfer" amount={stats.bank} icon="🏦" />
          </div>

          <div className="flex gap-3">
            <Link
              to="/new-bill"
              className="bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded hover:bg-slate-700 transition-colors"
            >
              ➕ New OPD Bill
            </Link>
            <Link
              to="/all-bills"
              className="border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 rounded hover:bg-slate-50 transition-colors"
            >
              📋 View All Bills
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function ModeCard({ mode, amount, icon }) {
  return (
    <div className="border border-slate-200 bg-white rounded-lg p-4">
      <p className="text-lg mb-1">{icon}</p>
      <p className="text-xs text-slate-500">{mode}</p>
      <p className="text-base font-semibold text-slate-800">₹{amount.toLocaleString('en-IN')}</p>
    </div>
  );
}