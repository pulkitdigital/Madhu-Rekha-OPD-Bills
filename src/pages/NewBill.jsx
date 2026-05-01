// src/pages/NewBill.jsx
import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { amountToWords } from '../utils/amountToWords';
import ReceiptPreview from '../components/ReceiptPreview';

const today = () => new Date().toISOString().slice(0, 10);

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
  paymentMode: 'Cash',
};

export default function NewBill() {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'amount') {
        updated.amountWords = amountToWords(value);
      }
      return updated;
    });
    setSaved(false);
    setError('');
  };

  const validate = () => {
    if (!form.receiptNo.trim()) return 'Receipt No. is required.';
    if (!form.receivedFrom.trim()) return '"Received with thanks from" is required.';
    if (!form.name.trim()) return 'Patient name (Mr./Mrs.) is required.';
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0)
      return 'Valid amount is required.';
    return '';
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    try {
      // ✅ setDoc with receiptNo as document ID (replaces addDoc)
      const docRef = doc(db, 'receipts', form.receiptNo.trim());
      await setDoc(docRef, {
        receiptNo: form.receiptNo.trim(),
        date: form.date,
        receivedFrom: form.receivedFrom.trim(),
        name: form.name.trim(),
        address: form.address.trim(),
        amount: Number(form.amount),
        amountWords: form.amountWords,
        purpose: form.purpose.trim(),
        operation: form.operation.trim(),
        paymentMode: form.paymentMode,
        createdAt: serverTimestamp(),
      });
      setSaved(true);
    } catch (e) {
      setError('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPrint = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (!saved) await handleSave();
    setTimeout(() => window.print(), 300);
  };

  const handleReset = () => {
    setForm(defaultForm);
    setSaved(false);
    setError('');
  };

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
          <Field
            label="Receipt No. *"
            name="receiptNo"
            value={form.receiptNo}
            onChange={handleChange}
            placeholder="e.g. 13179"
          />
          <Field
            label="Date *"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
          />
          <Field
            label="Received with thanks from *"
            name="receivedFrom"
            value={form.receivedFrom}
            onChange={handleChange}
            placeholder="Name on receipt line"
          />
          <Field
            label="Mr./Mrs. (Patient Name) *"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Full patient name"
          />
          <Field
            label="Address"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Village / Town, District"
          />
          <Field
            label="Amount (₹) *"
            name="amount"
            type="number"
            value={form.amount}
            onChange={handleChange}
            placeholder="0"
            min="0"
          />

          {/* Amount in words (read-only) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Amount in Words
            </label>
            <div className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 min-h-[34px]">
              {form.amountWords || (
                <span className="text-slate-400">Auto-generated</span>
              )}
            </div>
          </div>

          <Field
            label="Purpose"
            name="purpose"
            value={form.purpose}
            onChange={handleChange}
          />
          <Field
            label="Operation / Procedure"
            name="operation"
            value={form.operation}
            onChange={handleChange}
            placeholder="Optional"
          />

          {/* Payment Mode */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Payment Mode
            </label>
            <select
              name="paymentMode"
              value={form.paymentMode}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
            </select>
          </div>
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
            disabled={saving || saved}
            className="w-full border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {saved ? '✓ Saved' : 'Save Only'}
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
          <ReceiptPreview data={form} />
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