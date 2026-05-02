// src/pages/PaymentPDF.jsx

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

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

export default function PaymentPDF() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Read date range from URL query params
  const params = new URLSearchParams(window.location.search);
  const fromDate = params.get('from') || '';
  const toDate   = params.get('to')   || '';

  // ── Add pdf-print-page class to body ──────────────────
  useEffect(() => {
    document.body.classList.add('pdf-print-page');
    return () => document.body.classList.remove('pdf-print-page');
  }, []);

  // ── Load data from Firestore ───────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'receipts'), orderBy('createdAt', 'desc'))
        );
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const filtered = all.filter((b) => {
          if (fromDate && b.date < fromDate) return false;
          if (toDate   && b.date > toDate)   return false;
          return true;
        });
        setBills(filtered);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Auto-print once data loaded ────────────────────────
  useEffect(() => {
    if (!loading && bills.length > 0) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [loading, bills]);

  const totalSum = bills.reduce((s, b) => s + (b.amount || 0), 0);
  const cashSum  = bills.reduce((s, b) => s + getModeAmount(b, 'Cash'), 0);
  const upiSum   = bills.reduce((s, b) => s + getModeAmount(b, 'UPI'), 0);
  const bankSum  = bills.reduce((s, b) => s + getModeAmount(b, 'Bank Transfer'), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '100vh', fontFamily: 'sans-serif', color: '#64748b' }}>
        Loading data…
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '100vh', fontFamily: 'sans-serif', color: '#64748b' }}>
        No records found for the selected range.
      </div>
    );
  }

  const s = {
    page: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      padding: '24px 28px',
      color: '#1e293b',
      background: '#fff',
    },
    center: { textAlign: 'center', marginBottom: '16px' },
    title: { fontSize: '20px', fontWeight: 'bold', margin: 0 },
    subtitle: { fontSize: '11px', color: '#64748b', marginTop: '3px' },
    summaryBox: {
      display: 'flex',
      gap: '0',
      marginBottom: '18px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      overflow: 'hidden',
    },
    summaryCell: {
      flex: 1,
      padding: '10px 14px',
      borderRight: '1px solid #e2e8f0',
      background: '#f8fafc',
    },
    summaryCellLast: {
      flex: 1,
      padding: '10px 14px',
      background: '#f8fafc',
    },
    summaryLabel: {
      fontSize: '10px', color: '#64748b', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    },
    summaryValue: { fontSize: '15px', fontWeight: 'bold', marginTop: '2px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: {
      padding: '7px 10px', fontSize: '10px', fontWeight: 700,
      color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
      background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textAlign: 'left',
    },
    thRight: {
      padding: '7px 10px', fontSize: '10px', fontWeight: 700,
      color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
      background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textAlign: 'right',
    },
    tdBase: { padding: '6px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
    footerRow: { background: '#f8fafc', borderTop: '2px solid #cbd5e1' },
    footerTd: { padding: '8px 10px', fontWeight: 700, fontSize: '13px' },
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { margin: 0; background: white; }
        }
      `}</style>

      <div style={s.page}>

        {/* ── Header ── */}
        <div style={s.center}>
          <div style={s.title}>Madhurekha Eye Care Centre</div>
          <div style={s.subtitle}>OPD Billing — Payment Report</div>
          {(fromDate || toDate) && (
            <div style={s.subtitle}>
              Period:{' '}
              {fromDate ? fromDate.split('-').reverse().join('/') : 'Start'}
              {' — '}
              {toDate ? toDate.split('-').reverse().join('/') : 'Today'}
            </div>
          )}
        </div>

        {/* ── Summary Box ── */}
        <div style={s.summaryBox}>
          {[
            { label: 'Total Collection', value: totalSum,      color: '#16a34a', last: false },
            { label: 'Cash',             value: cashSum,       color: '#059669', last: false },
            { label: 'UPI',              value: upiSum,        color: '#2563eb', last: false },
            { label: 'Bank Transfer',    value: bankSum,       color: '#7c3aed', last: false },
            { label: 'Total Bills',      value: bills.length,  color: '#334155', last: true, plain: true },
          ].map((c) => (
            <div key={c.label} style={c.last ? s.summaryCellLast : s.summaryCell}>
              <div style={s.summaryLabel}>{c.label}</div>
              <div style={{ ...s.summaryValue, color: c.color }}>
                {c.plain ? c.value : `₹${c.value.toLocaleString('en-IN')}`}
              </div>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>#</th>
              <th style={s.th}>Date</th>
              <th style={s.th}>Receipt No.</th>
              <th style={s.th}>Patient</th>
              <th style={s.th}>Mode</th>
              <th style={s.thRight}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b, i) => {
              const label = modeLabel(b);
              const even  = i % 2 === 0;
              return (
                <tr key={b.id} style={{ background: even ? '#fff' : '#f8fafc' }}>
                  <td style={{ ...s.tdBase, color: '#94a3b8', width: '28px' }}>{i + 1}</td>
                  <td style={{ ...s.tdBase, whiteSpace: 'nowrap', color: '#64748b' }}>
                    {b.date ? b.date.split('-').reverse().join('/') : '—'}
                  </td>
                  <td style={{ ...s.tdBase, fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                    {b.receiptNo}
                  </td>
                  <td style={s.tdBase}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    {b.address && (
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>
                        {b.address}
                      </div>
                    )}
                  </td>
                  <td style={s.tdBase}>
                    <div style={{ fontWeight: 500 }}>{label}</div>
                    {label === 'Split' && b.paymentSplit && (
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>
                        {b.paymentSplit
                          .filter((r) => r.amount > 0)
                          .map((r) => `${r.mode}: ₹${r.amount.toLocaleString('en-IN')}`)
                          .join(' | ')}
                      </div>
                    )}
                  </td>
                  <td style={{ ...s.tdBase, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                    ₹{(b.amount || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={s.footerRow}>
              <td colSpan={5} style={{ ...s.footerTd, color: '#334155' }}>
                Total — {bills.length} bill{bills.length !== 1 ? 's' : ''}
              </td>
              <td style={{ ...s.footerTd, textAlign: 'right', color: '#16a34a', fontSize: '14px' }}>
                ₹{totalSum.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ── Footer ── */}
        <div style={{ marginTop: '20px', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
          Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>

        {/* ── Print Button (screen only) ── */}
        {/* <div style={{ marginTop: '24px', textAlign: 'center' }} className="no-print">
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 28px', background: '#1e293b', color: '#fff',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '14px', fontFamily: 'sans-serif',
            }}
          >
            🖨️ Print / Save as PDF
          </button>
        </div> */}

      </div>
    </>
  );
}