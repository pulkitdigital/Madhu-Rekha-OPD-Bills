// src/pages/AllBills.jsx
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { amountToWords } from '../utils/amountToWords';
import ReceiptPreview from '../components/ReceiptPreview';

// ── Helper: sum a specific mode from paymentSplit or fallback paymentMode ──
function getModeAmount(bill, mode) {
  if (bill.paymentSplit?.length > 0) {
    return bill.paymentSplit
      .filter((r) => r.mode === mode)
      .reduce((s, r) => s + (r.amount || 0), 0);
  }
  // Legacy: single paymentMode field
  return bill.paymentMode === mode ? (bill.amount || 0) : 0;
}

// ── Helper: display label for payment mode badge ──
function modeLabel(bill) {
  if (bill.paymentSplit?.length > 1) {
    const modes = bill.paymentSplit.filter((r) => r.amount > 0).map((r) => r.mode);
    if (modes.length > 1) return 'Split';
  }
  return bill.paymentMode || 'Cash';
}

export default function AllBills() {
  const [bills, setBills] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [viewBill, setViewBill] = useState(null);
  const [editBill, setEditBill] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editRows, setEditRows] = useState([{ mode: 'Cash', amount: '' }]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'receipts'), orderBy('createdAt', 'desc')));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBills(data);
      setFiltered(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let result = [...bills];
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (b) => b.name?.toLowerCase().includes(s) || b.receiptNo?.toLowerCase().includes(s)
      );
    }
    if (dateFilter) result = result.filter((b) => b.date === dateFilter);
    setFiltered(result);
  }, [search, dateFilter, bills]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this receipt?')) return;
    await deleteDoc(doc(db, 'receipts', id));
    load();
  };

  const handlePrint = (bill) => {
    setViewBill(bill);
    setTimeout(() => window.print(), 300);
  };

  // ── Edit: open modal ───────────────────────────────────────────────────────
  const openEdit = (b) => {
    setEditBill(b);
    setEditForm({ ...b });
    // Populate split rows from saved data
    if (b.paymentSplit?.length > 0) {
      setEditRows(b.paymentSplit.map((r) => ({ mode: r.mode, amount: String(r.amount) })));
    } else {
      setEditRows([{ mode: b.paymentMode || 'Cash', amount: String(b.amount || '') }]);
    }
  };

  // ── Edit: split row helpers ────────────────────────────────────────────────
  const ALL_MODES = ['Cash', 'UPI', 'Bank Transfer'];

  const editSplitTotal = editRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const editTotalAmount = parseFloat(editForm.amount) || 0;
  const editRemaining = editTotalAmount - editSplitTotal;
  const editUsedModes = editRows.map((r) => r.mode);
  const editAvailableModes = ALL_MODES.filter((m) => !editUsedModes.includes(m));

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
    if (editRows.length >= 3 || editAvailableModes.length === 0) return;
    setEditRows((prev) => [...prev, { mode: editAvailableModes[0], amount: '' }]);
  };

  const removeEditRow = (index) => {
    if (editRows.length <= 1) return;
    setEditRows((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Edit: save ─────────────────────────────────────────────────────────────
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
        ...rest,
        amount,
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

  // ── Summary totals (from paymentSplit) ────────────────────────────────────
  const totalAmount = filtered.reduce((s, b) => s + (b.amount || 0), 0);
  const cashTotal = filtered.reduce((s, b) => s + getModeAmount(b, 'Cash'), 0);
  const upiTotal = filtered.reduce((s, b) => s + getModeAmount(b, 'UPI'), 0);
  const bankTotal = filtered.reduce((s, b) => s + getModeAmount(b, 'Bank Transfer'), 0);

  const modeStyle = (label) => {
    if (label === 'Cash') return 'bg-green-100 text-green-700';
    if (label === 'UPI') return 'bg-blue-100 text-blue-700';
    if (label === 'Bank Transfer') return 'bg-purple-100 text-purple-700';
    return 'bg-orange-100 text-orange-700'; // Split
  };

  const remainingColor = editRemaining === 0 && editSplitTotal > 0
    ? 'text-green-600' : editRemaining < 0 ? 'text-red-600' : 'text-amber-600';

  return (
    <div>

      {/* ── VIEW MODAL ── */}
      {viewBill && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setViewBill(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Receipt Preview</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setTimeout(() => window.print(), 100)}
                  className="bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  🖨 Print
                </button>
                <button
                  onClick={() => setViewBill(null)}
                  className="bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <ReceiptPreview data={{
              ...viewBill,
              paymentRows: viewBill.paymentSplit || [],
            }} />
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editBill && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEditBill(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
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
                    type={type}
                    value={editForm[key] || ''}
                    onChange={(e) => {
                      const val = type === 'number' ? Number(e.target.value) : e.target.value;
                      setEditForm({ ...editForm, [key]: val });
                      // Reset split rows when total amount changes
                      if (key === 'amount') {
                        setEditRows([{ mode: 'Cash', amount: '' }]);
                      }
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              ))}

              {/* Payment Split */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">Payment Breakdown</label>
                  {editTotalAmount > 0 && editRows.length < 3 && editAvailableModes.length > 0 && (
                    <button
                      type="button"
                      onClick={addEditRow}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Add Mode
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_1fr_auto] bg-slate-50 px-3 py-1.5 border-b border-slate-200 gap-2">
                    <span className="text-xs font-medium text-slate-500">Mode</span>
                    <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
                    <span />
                  </div>

                  {editRows.map((row, idx) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-[1fr_1fr_auto] px-3 py-1.5 gap-2 items-center ${idx !== editRows.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <select
                        value={row.mode}
                        onChange={(e) => handleEditRowChange(idx, 'mode', e.target.value)}
                        className="border border-slate-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      >
                        {ALL_MODES.filter((m) => m === row.mode || !editUsedModes.includes(m)).map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.amount}
                        onChange={(e) => handleEditRowChange(idx, 'amount', e.target.value)}
                        disabled={!editTotalAmount}
                        className="border border-slate-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                      {editRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEditRow(idx)}
                          className="text-slate-300 hover:text-red-500 text-base leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Remaining footer */}
                  {editTotalAmount > 0 && editSplitTotal > 0 && (
                    <div className="grid grid-cols-[1fr_1fr_auto] px-3 py-1.5 bg-slate-50 border-t border-slate-200 gap-2">
                      <span className={`text-xs font-semibold ${remainingColor}`}>
                        {editRemaining === 0 && editSplitTotal > 0 ? '✓ Balanced'
                          : editRemaining > 0 ? 'Remaining' : 'Excess'}
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
              <button
                onClick={() => setEditBill(null)}
                className="bg-slate-100 text-slate-600 px-5 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving}
                className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold text-slate-800">All Bills & Receipts</h1>
        <span className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-2 text-sm font-bold">
          Total: ₹{totalAmount.toLocaleString('en-IN')}
        </span>
      </div>

      {/* ── SUMMARY STRIP ── */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'All Bills', count: filtered.length, amount: totalAmount, bg: 'bg-slate-800', text: 'text-white', sub: 'text-slate-300' },
          { label: 'Cash', count: null, amount: cashTotal, bg: 'bg-green-50', text: 'text-green-800', sub: 'text-green-500' },
          { label: 'UPI', count: null, amount: upiTotal, bg: 'bg-blue-50', text: 'text-blue-800', sub: 'text-blue-400' },
          { label: 'Bank Transfer', count: null, amount: bankTotal, bg: 'bg-purple-50', text: 'text-purple-800', sub: 'text-purple-400' },
        ].map((c) => (
          <div key={c.label} className={`${c.bg} rounded-xl px-4 py-3 border border-black/5`}>
            <p className={`text-xs font-semibold ${c.text} opacity-75`}>{c.label}</p>
            <p className={`text-base font-bold ${c.text} mt-1`}>₹{c.amount.toLocaleString('en-IN')}</p>
            {c.count !== null && (
              <p className={`text-xs ${c.sub}`}>{c.count} bill{c.count !== 1 ? 's' : ''}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="Search by name or receipt no…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-64 bg-white"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
        />
        {(search || dateFilter) && (
          <button
            onClick={() => { setSearch(''); setDateFilter(''); }}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── TABLE ── */}
      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Receipt No.', 'Patient Name', 'Mode', 'Amount', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide ${h === 'Amount' ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No bills found.
                  </td>
                </tr>
              ) : (
                filtered.map((b, i) => {
                  const label = modeLabel(b);
                  return (
                    <tr
                      key={b.id}
                      className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}
                    >
                      <td className="px-4 py-3 text-slate-500 text-sm">
                        {b.date ? b.date.split('-').reverse().join('.') : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 font-semibold">
                        {b.receiptNo}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{b.name}</p>
                        {b.address && <p className="text-xs text-slate-400">{b.address}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${modeStyle(label)}`}>
                          {label}
                        </span>
                        {/* Show split breakdown on hover via title */}
                        {label === 'Split' && b.paymentSplit && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {b.paymentSplit.filter(r => r.amount > 0).map(r => `${r.mode}: ₹${r.amount.toLocaleString('en-IN')}`).join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700 text-sm">
                        + ₹{(b.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          <ActionBtn label="Print" className="bg-slate-800 text-white hover:bg-slate-700" onClick={() => handlePrint(b)} />
                          <ActionBtn label="View" className="bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={() => setViewBill(b)} />
                          <ActionBtn label="Edit" className="bg-green-50 text-green-700 hover:bg-green-100" onClick={() => openEdit(b)} />
                          <ActionBtn label="Delete" className="bg-red-50 text-red-600 hover:bg-red-100" onClick={() => handleDelete(b.id)} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, className, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${className}`}
    >
      {label}
    </button>
  );
}