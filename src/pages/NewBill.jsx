// src/pages/NewBill.jsx
import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { amountToWords } from '../utils/amountToWords';
import ReceiptPreview from '../components/ReceiptPreview';

const today = () => new Date().toISOString().slice(0, 10);
const ALL_MODES = ['Cash', 'UPI', 'Bank Transfer'];

const defaultForm = {
  receiptNo: '',
  date: today(),
  receivedFrom: '',
  name: '',
  address: '',
  amount: '',
  amountWords: '',
  purpose: 'Consultancy Fees',
  operation: '',
};

export default function NewBill() {
  const [form, setForm] = useState(defaultForm);
  const [paymentRows, setPaymentRows] = useState([{ mode: 'Cash', amount: '' }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // ✅ Holds a snapshot of the last saved bill — used to keep preview filled during print
  const [printData, setPrintData] = useState(null);

  const totalAmount = parseFloat(form.amount) || 0;
  const splitTotal = paymentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const remaining = totalAmount - splitTotal;

  const usedModes = paymentRows.map((r) => r.mode);
  const availableModes = ALL_MODES.filter((m) => !usedModes.includes(m));

  // ── Add row ────────────────────────────────────────────────────────────────
  const addRow = () => {
    if (paymentRows.length >= 3 || availableModes.length === 0) return;
    setPaymentRows((prev) => [...prev, { mode: availableModes[0], amount: '' }]);
    setSaved(false);
  };

  // ── Remove row — first row (index 0) is protected ─────────────────────────
  const removeRow = (index) => {
    if (index === 0) return;
    setPaymentRows((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
    setError('');
  };

  // ── Row change ─────────────────────────────────────────────────────────────
  const handleRowChange = (index, field, value) => {
    setPaymentRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === 'amount') {
          const otherSum = prev.reduce(
            (s, r, ri) => ri !== index ? s + (parseFloat(r.amount) || 0) : s,
            0
          );
          const max = totalAmount - otherSum;
          const capped = Math.min(parseFloat(value) || 0, max);
          return { ...row, amount: value === '' ? '' : String(capped) };
        }
        return { ...row, [field]: value };
      })
    );
    setSaved(false);
    setError('');
  };

  // ── Form field change ──────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'amount') {
        updated.amountWords = amountToWords(value);
        setPaymentRows([{ mode: 'Cash', amount: '' }]);
      }
      return updated;
    });
    setSaved(false);
    setError('');
  };

  // ── Validate ───────────────────────────────────────────────────────────────
  const validate = () => {
    if (!form.receiptNo.trim()) return 'Receipt No. is required.';
    if (!form.receivedFrom.trim()) return '"Received with thanks from" is required.';
    if (!form.name.trim()) return 'Patient name (Mr./Mrs.) is required.';
    if (!form.amount || isNaN(form.amount) || totalAmount <= 0)
      return 'Valid total amount is required.';
    if (Math.abs(remaining) > 0.01)
      return `Split total (₹${splitTotal}) must equal total amount (₹${totalAmount}).`;
    return '';
  };

  // ── Reset helper ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ ...defaultForm, date: today() });
    setPaymentRows([{ mode: 'Cash', amount: '' }]);
    setError('');
    setSaved(false);
  };

  // ── Shared DB write logic ──────────────────────────────────────────────────
  const saveToDb = async (formSnap, rowsSnap) => {
    const docRef = doc(db, 'receipts', formSnap.receiptNo.trim());
    const paymentSplit = rowsSnap
      .filter((r) => parseFloat(r.amount) > 0)
      .map((r) => ({ mode: r.mode, amount: parseFloat(r.amount) }));

    const primaryMode =
      paymentSplit.length > 1 ? 'Split'
      : paymentSplit.length === 1 ? paymentSplit[0].mode
      : 'Cash';

    await setDoc(docRef, {
      receiptNo: formSnap.receiptNo.trim(),
      date: formSnap.date,
      receivedFrom: formSnap.receivedFrom.trim(),
      name: formSnap.name.trim(),
      address: formSnap.address.trim(),
      amount: parseFloat(formSnap.amount),
      amountWords: formSnap.amountWords,
      purpose: formSnap.purpose.trim(),
      operation: formSnap.operation.trim(),
      paymentMode: primaryMode,
      paymentSplit:
        paymentSplit.length > 0
          ? paymentSplit
          : [{ mode: 'Cash', amount: parseFloat(formSnap.amount) }],
      createdAt: serverTimestamp(),
    });
  };

  // ── Save Only ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    try {
      await saveToDb(form, paymentRows);
      setSaved(true);
      resetForm(); // ✅ clear fields after save
    } catch (e) {
      setError('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Save & Print ───────────────────────────────────────────────────────────
  const handleSaveAndPrint = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    // ✅ Step 1: Snapshot BEFORE reset — so preview stays filled during print
    const formSnap = { ...form };
    const rowsSnap = [...paymentRows];

    setSaving(true);
    try {
      await saveToDb(formSnap, rowsSnap);
      setSaved(true);

      // ✅ Step 2: Put snapshot into printData — preview will render this
      setPrintData({ ...formSnap, paymentRows: rowsSnap });

      // ✅ Step 3: Reset form
      resetForm();

      // ✅ Step 4: Print after React re-renders the preview with printData
      setTimeout(() => {
        window.print();
        // Clear printData a moment after print dialog opens
        setTimeout(() => setPrintData(null), 1000);
      }, 300);
    } catch (e) {
      setError('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPrintData(null);
    resetForm();
  };

  const remainingColor =
    remaining === 0 && splitTotal > 0 ? 'text-green-600'
    : remaining < 0 ? 'text-red-600'
    : 'text-amber-600';

  // ✅ Preview uses printData snapshot (during print window) or live form data
  const previewData = printData ?? { ...form, paymentRows };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* ── LEFT: FORM ── */}
      <div className="lg:w-80 flex-shrink-0">
        <h1 className="text-lg font-semibold text-slate-800 mb-4">New OPD Bill</h1>

        {error && (
          <div className="mb-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-3 text-sm bg-green-50 border border-green-200 text-green-700 rounded px-3 py-2">
            ✓ Saved to database successfully.
          </div>
        )}

        <div className="space-y-3">
          <Field label="Receipt No. *" name="receiptNo" value={form.receiptNo} onChange={handleChange} placeholder="e.g. 13179" />
          <Field label="Date *" name="date" type="date" value={form.date} onChange={handleChange} />
          <Field label="Received with thanks from *" name="receivedFrom" value={form.receivedFrom} onChange={handleChange} placeholder="Name on receipt line" />
          <Field label="Mr./Mrs. (Patient Name) *" name="name" value={form.name} onChange={handleChange} placeholder="Full patient name" />
          <Field label="Address" name="address" value={form.address} onChange={handleChange} placeholder="Village / Town, District" />

          <Field
            label="Total Amount (₹) *"
            name="amount"
            type="number"
            value={form.amount}
            onChange={handleChange}
            placeholder="0"
            min="0"
          />

          {/* Amount in Words */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount in Words</label>
            <div className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 min-h-[34px]">
              {form.amountWords || <span className="text-slate-400">Auto-generated</span>}
            </div>
          </div>

          {/* ── PAYMENT BREAKDOWN ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Payment Breakdown</label>
              {paymentRows.length < 3 && availableModes.length > 0 && (
                <button
                  type="button"
                  onClick={addRow}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add Mode
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto] bg-slate-50 px-3 py-1.5 border-b border-slate-200 gap-2">
                <span className="text-xs font-medium text-slate-500">Mode</span>
                <span className="text-xs font-medium text-slate-500">Amount (₹)</span>
                <span />
              </div>

              {paymentRows.map((row, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-[1fr_1fr_auto] px-3 py-1.5 gap-2 items-center ${
                    idx !== paymentRows.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <select
                    value={row.mode}
                    onChange={(e) => handleRowChange(idx, 'mode', e.target.value)}
                    className="border border-slate-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  >
                    {ALL_MODES.filter(
                      (m) => m === row.mode || !usedModes.includes(m)
                    ).map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={row.amount}
                    onChange={(e) => handleRowChange(idx, 'amount', e.target.value)}
                    className="border border-slate-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />

                  {/* First row: no delete button */}
                  {idx === 0 ? (
                    <span className="w-4" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-slate-300 hover:text-red-500 text-base leading-none"
                      title="Remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              <div className="grid grid-cols-[1fr_1fr_auto] px-3 py-1.5 bg-slate-50 border-t border-slate-200 gap-2">
                <span className={`text-xs font-semibold ${remainingColor}`}>
                  {remaining === 0 && splitTotal > 0
                    ? '✓ Balanced'
                    : remaining > 0
                    ? 'Remaining'
                    : 'Excess'}
                </span>
                <span className={`text-xs font-semibold ${remainingColor}`}>
                  {remaining !== 0
                    ? `₹ ${Math.abs(remaining).toLocaleString('en-IN')}`
                    : ''}
                </span>
                <span />
              </div>
            </div>
          </div>

          <Field label="Purpose" name="purpose" value={form.purpose} onChange={handleChange} />
          <Field label="Operation / Procedure" name="operation" value={form.operation} onChange={handleChange} placeholder="Optional" />
        </div>

        {/* ── BUTTONS ── */}
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={handleSaveAndPrint}
            disabled={saving}
            className="w-full bg-slate-800 text-white text-sm font-medium py-2 rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : '🖨️ Save & Print'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Save Only
          </button>
          <button
            onClick={handleReset}
            className="w-full border border-slate-200 text-slate-500 text-sm py-1.5 rounded hover:bg-slate-50 transition-colors"
          >
            Reset Form
          </button>
        </div>
      </div>

      {/* ── RIGHT: LIVE PREVIEW ── */}
      <div className="flex-1">
        <h2 className="text-sm font-medium text-slate-500 mb-3">Live Preview</h2>
        <div className="overflow-auto">
          <ReceiptPreview data={previewData} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = 'text', placeholder = '', min }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}