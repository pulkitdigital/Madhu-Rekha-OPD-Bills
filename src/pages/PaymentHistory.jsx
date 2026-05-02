// src/pages/PaymentHistory.jsx
import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { amountToWords } from '../utils/amountToWords';
import ReceiptPreview from '../components/ReceiptPreview';

const ALL_MODES = ['Cash', 'UPI', 'Bank Transfer'];

function getModeAmount(bill, mode) {
  if (bill.paymentSplit?.length > 0) {
    return bill.paymentSplit
      .filter((r) => r.mode === mode)
      .reduce((s, r) => s + (r.amount || 0), 0);
  }
  return bill.paymentMode === mode ? (bill.amount || 0) : 0;
}

function modeLabel(bill) {
  if (bill.paymentSplit?.filter((r) => r.amount > 0).length > 1) return 'Split';
  return bill.paymentMode || 'Cash';
}

function modeStyle(label) {
  if (label === 'Cash') return 'bg-green-100 text-green-700';
  if (label === 'UPI') return 'bg-blue-100 text-blue-700';
  if (label === 'Bank Transfer') return 'bg-purple-100 text-purple-700';
  return 'bg-orange-100 text-orange-700';
}

export default function PaymentHistory() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [editBill, setEditBill] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editRows, setEditRows] = useState([{ mode: 'Cash', amount: '' }]);
  const [saving, setSaving] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [dlFrom, setDlFrom] = useState('');
  const [dlTo, setDlTo] = useState('');
  const dropdownRef = useRef(null);

  // Single receipt print
  const [printBill, setPrintBill] = useState(null);

  const load = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'receipts'), orderBy('createdAt', 'desc')));
      setBills(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDownload(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Single receipt print trigger
  useEffect(() => {
    if (!printBill) return;
    const timer = setTimeout(() => {
      window.print();
      const afterPrint = () => {
        setPrintBill(null);
        window.removeEventListener('afterprint', afterPrint);
      };
      window.addEventListener('afterprint', afterPrint);
    }, 400);
    return () => clearTimeout(timer);
  }, [printBill]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = bills.filter((b) => {
    if (fromDate && b.date < fromDate) return false;
    if (toDate && b.date > toDate) return false;
    return true;
  });

  const totalSum = filtered.reduce((s, b) => s + (b.amount || 0), 0);
  const cashSum  = filtered.reduce((s, b) => s + getModeAmount(b, 'Cash'), 0);
  const upiSum   = filtered.reduce((s, b) => s + getModeAmount(b, 'UPI'), 0);
  const bankSum  = filtered.reduce((s, b) => s + getModeAmount(b, 'Bank Transfer'), 0);

  const tabFiltered =
    activeTab === 'All'
      ? filtered
      : filtered.filter((b) => {
          if (activeTab === 'Split') return modeLabel(b) === 'Split';
          return getModeAmount(b, activeTab) > 0;
        });

  const byDate = tabFiltered.reduce((acc, b) => {
    const d = b.date || 'Unknown';
    if (!acc[d]) acc[d] = [];
    acc[d].push(b);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort((a, b) => (a > b ? -1 : 1));

  const splitCount = filtered.filter((b) => modeLabel(b) === 'Split').length;
  const tabs = [
    { key: 'All',           label: `All (${filtered.length})` },
    { key: 'Cash',          label: `Cash (${filtered.filter(b => getModeAmount(b, 'Cash') > 0).length})` },
    { key: 'UPI',           label: `UPI (${filtered.filter(b => getModeAmount(b, 'UPI') > 0).length})` },
    { key: 'Bank Transfer', label: `Bank Transfer (${filtered.filter(b => getModeAmount(b, 'Bank Transfer') > 0).length})` },
    ...(splitCount > 0 ? [{ key: 'Split', label: `Split (${splitCount})` }] : []),
  ];

  // ── Download PDF → open /payment-pdf in a new tab ──────────────────────────
  // PaymentPDF page fetches its own data using URL query params as filter.
  // No print-in-same-page tricks needed — blank page problem fully solved.
  const handleDownload = () => {
    const params = new URLSearchParams();
    if (dlFrom) params.set('from', dlFrom);
    if (dlTo)   params.set('to',   dlTo);
    const url = `/payment-pdf${params.toString() ? '?' + params.toString() : ''}`;
    window.open(url, '_blank');
    setShowDownload(false);
  };

  const applyRange = (range) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    if (range === 'all') {
      setDlFrom(''); setDlTo('');
    } else if (range === '1m') {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      setDlFrom(fmt(d)); setDlTo(fmt(today));
    } else if (range === '6m') {
      const d = new Date(); d.setMonth(d.getMonth() - 6);
      setDlFrom(fmt(d)); setDlTo(fmt(today));
    } else if (range === '1y') {
      const d = new Date(); d.setFullYear(d.getFullYear() - 1);
      setDlFrom(fmt(d)); setDlTo(fmt(today));
    }
  };

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const openEdit = (b) => {
    setEditBill(b);
    setEditForm({ ...b });
    if (b.paymentSplit?.length > 0) {
      setEditRows(b.paymentSplit.map((r) => ({ mode: r.mode, amount: String(r.amount) })));
    } else {
      setEditRows([{ mode: b.paymentMode || 'Cash', amount: String(b.amount || '') }]);
    }
  };

  const editTotalAmount = parseFloat(editForm.amount) || 0;
  const editSplitTotal  = editRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const editRemaining   = editTotalAmount - editSplitTotal;
  const editUsedModes   = editRows.map((r) => r.mode);
  const editAvailModes  = ALL_MODES.filter((m) => !editUsedModes.includes(m));

  const handleEditRowChange = (index, field, value) => {
    setEditRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === 'amount') {
          const otherSum = prev.reduce((s, r, ri) => ri !== index ? s + (parseFloat(r.amount) || 0) : s, 0);
          const max = editTotalAmount - otherSum;
          const capped = Math.min(parseFloat(value) || 0, max);
          return { ...row, amount: value === '' ? '' : String(capped) };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const addEditRow = () => {
    if (editRows.length >= 3 || editAvailModes.length === 0) return;
    setEditRows((prev) => [...prev, { mode: editAvailModes[0], amount: '' }]);
  };

  const removeEditRow = (index) => {
    if (index === 0) return;
    setEditRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSave = async () => {
    setSaving(true);
    try {
      const paymentSplit = editRows
        .filter((r) => parseFloat(r.amount) > 0)
        .map((r) => ({ mode: r.mode, amount: parseFloat(r.amount) }));
      const primaryMode =
        paymentSplit.length > 1 ? 'Split'
        : paymentSplit.length === 1 ? paymentSplit[0].mode
        : 'Cash';
      const amount = parseFloat(editForm.amount) || 0;
      const { id, createdAt, ...rest } = editForm;
      await updateDoc(doc(db, 'receipts', editBill.id), {
        ...rest, amount,
        amountWords: amountToWords(amount),
        paymentMode: primaryMode,
        paymentSplit: paymentSplit.length > 0 ? paymentSplit : [{ mode: primaryMode, amount }],
      });
      setEditBill(null);
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const remainingColor =
    editRemaining === 0 && editSplitTotal > 0 ? 'text-green-600'
    : editRemaining < 0 ? 'text-red-600'
    : 'text-amber-600';

  return (
    <div>
      {/* ── Print CSS for single receipt only ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #receipt-print-area { display: block !important; }
        }
        #receipt-print-area { display: none; }
      `}</style>

      {/* Single receipt print area */}
      <div id="receipt-print-area">
        {printBill && (
          <ReceiptPreview data={{ ...printBill, paymentRows: printBill.paymentSplit || [] }} />
        )}
      </div>

      {/* ── EDIT MODAL ── */}
      {editBill && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditBill(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-5">Edit Receipt</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Receipt No.', key: 'receiptNo', span: 1 },
                { label: 'Date', key: 'date', type: 'date', span: 1 },
                { label: 'Received with thanks from', key: 'receivedFrom', span: 2 },
                { label: 'Patient Name', key: 'name', span: 2 },
                { label: 'Address', key: 'address', span: 2 },
                { label: 'Total Amount (₹)', key: 'amount', type: 'number', span: 1 },
                { label: 'Purpose', key: 'purpose', span: 1 },
                { label: 'Operation / Procedure', key: 'operation', span: 2 },
              ].map(({ label, key, type = 'text', span }) => (
                <div key={key} className={span === 2 ? 'col-span-2' : 'col-span-1'}>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                  <input
                    type={type} value={editForm[key] || ''}
                    onChange={(e) => {
                      const val = type === 'number' ? Number(e.target.value) : e.target.value;
                      setEditForm({ ...editForm, [key]: val });
                      if (key === 'amount') setEditRows([{ mode: 'Cash', amount: '' }]);
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">Payment Breakdown</label>
                  {editRows.length < 3 && editAvailModes.length > 0 && (
                    <button type="button" onClick={addEditRow} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Mode</button>
                  )}
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr_1fr_auto] bg-slate-50 px-3 py-1.5 border-b border-slate-200 gap-2">
                    <span className="text-xs font-medium text-slate-500">Mode</span>
                    <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
                    <span />
                  </div>
                  {editRows.map((row, idx) => (
                    <div key={idx} className={`grid grid-cols-[1fr_1fr_auto] px-3 py-1.5 gap-2 items-center ${idx !== editRows.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <select value={row.mode} onChange={(e) => handleEditRowChange(idx, 'mode', e.target.value)}
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                        {ALL_MODES.filter((m) => m === row.mode || !editUsedModes.includes(m)).map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <input type="number" min="0" placeholder="0" value={row.amount}
                        onChange={(e) => handleEditRowChange(idx, 'amount', e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      {idx === 0 ? <span className="w-4" /> : (
                        <button type="button" onClick={() => removeEditRow(idx)} className="text-slate-300 hover:text-red-500 text-base leading-none">×</button>
                      )}
                    </div>
                  ))}
                  {editTotalAmount > 0 && editSplitTotal > 0 && (
                    <div className="grid grid-cols-[1fr_1fr_auto] px-3 py-1.5 bg-slate-50 border-t border-slate-200 gap-2">
                      <span className={`text-xs font-semibold ${remainingColor}`}>
                        {editRemaining === 0 ? '✓ Balanced' : editRemaining > 0 ? 'Remaining' : 'Excess'}
                      </span>
                      <span className={`text-xs font-semibold ${remainingColor}`}>
                        {editRemaining !== 0 ? `₹ ${Math.abs(editRemaining).toLocaleString('en-IN')}` : ''}
                      </span>
                      <span />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setEditBill(null)} className="bg-slate-100 text-slate-600 px-5 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleEditSave} disabled={saving} className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold text-slate-800">All Payments</h1>
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setShowDownload((v) => !v)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download PDF
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDownload && (
            <div className="absolute right-0 top-11 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-72 p-4">
              <div className="space-y-0.5 mb-4">
                {[
                  { key: 'all', label: 'All Transactions' },
                  { key: '1m',  label: 'Last 1 Month' },
                  { key: '6m',  label: 'Last 6 Months' },
                  { key: '1y',  label: 'Last 1 Year' },
                ].map((r) => (
                  <button key={r.key} onClick={() => applyRange(r.key)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                    </svg>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Custom Range</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">From</label>
                    <input type="date" value={dlFrom} onChange={(e) => setDlFrom(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">To</label>
                    <input type="date" value={dlTo} onChange={(e) => setDlTo(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                  </div>
                </div>
                <button onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Open PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      {!loading && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Payments', amount: totalSum, color: 'text-green-600',   sub: `${filtered.length} bills` },
            { label: 'Cash',           amount: cashSum,  color: 'text-emerald-600', sub: '' },
            { label: 'UPI',            amount: upiSum,   color: 'text-blue-600',    sub: '' },
            { label: 'Bank Transfer',  amount: bankSum,  color: 'text-purple-600',  sub: '' },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs text-slate-500 font-semibold mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>₹ {c.amount.toLocaleString('en-IN')}.00</p>
              {c.sub && <p className="text-xs text-slate-400 mt-1">{c.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── DATE FILTER ── */}
      <div className="flex gap-3 mb-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        {(fromDate || toDate) && (
          <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
        )}
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border ${
              activeTab === t.key ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TABLE ── */}
      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Receipt No.', 'Patient', 'Mode', 'Amount', 'Actions'].map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDates.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">No records found.</td></tr>
              ) : (
                sortedDates.map((date) =>
                  byDate[date].map((b) => {
                    const label = modeLabel(b);
                    return (
                      <tr key={b.id} className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors bg-white">
                        <td className="px-4 py-3 text-slate-500 text-sm">{b.date ? b.date.split('-').reverse().join('.') : '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700 font-semibold">{b.receiptNo}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {b.name}
                          {b.address && <p className="text-xs text-slate-400 font-normal">{b.address}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${modeStyle(label)}`}>{label}</span>
                          {label === 'Split' && b.paymentSplit && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {b.paymentSplit.filter((r) => r.amount > 0).map((r) => `${r.mode}: ₹${r.amount.toLocaleString('en-IN')}`).join(', ')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 text-sm">+ ₹{(b.amount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => setPrintBill(b)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-700 transition-colors">PDF</button>
                            <button onClick={() => openEdit(b)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors">Edit</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}