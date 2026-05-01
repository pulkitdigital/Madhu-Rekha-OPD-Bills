// src/components/ReceiptPreview.jsx
export default function ReceiptPreview({ data }) {
  const {
    receiptNo = '',
    date = '',
    receivedFrom = '',
    name = '',
    address = '',
    amount = '',
    amountWords = '',
    purpose = 'Consultancy Fees',
    operation = '',
    paymentMode = 'Cash',
  } = data;

  const formatDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y.slice(2)}`;
  };

  return (
    <div
      id="receipt-print-area"
      className="bg-white relative overflow-hidden"
      style={{
        width: '148mm',
        minHeight: '105mm',
        fontFamily: 'ui-sans-serif system-ui -apple-system sans-serif',
        fontSize: '10.5px',
        padding: '4mm',
        boxSizing: 'border-box',
        letterSpacing: '0.01em',
      }}
    >
      {/* ══ OUTER BORDER FRAME ══ */}
      <div
        style={{
          border: '2.5px solid #111',
          padding: '3px',
          minHeight: 'calc(105mm - 8mm)',
          boxSizing: 'border-box',
        }}
      >
        {/* Inner rule */}
        <div
          style={{
            border: '1px solid #111',
            padding: '4mm 6mm',
            minHeight: 'calc(105mm - 8mm - 8px)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >

          {/* ══ HEADER ══ */}
          <div className="text-black text-center mb-1 px-2 py-0.5">
            <div
              className="font-black uppercase"
              style={{ fontSize: '17px', letterSpacing: '0.01em' }}
            >
              Madhurekha Eye Care Centre
            </div>
            <div
              className="font-normal mt-0.5"
              style={{ fontSize: '8.5px', letterSpacing: '0.03em' }}
            >
              SONARI : E-501, SONARI EAST LAYOUT, NEAR SABUJ SANGH KALI PUJA MAIDAN
            </div>
          </div>

          {/* ══ DOCTORS ROW ══ */}
          <div className="flex items-start justify-between mt-1 mb-1">

            {/* Left — Dr. Pradipta */}
            <div
              className="text-black leading-snug"
              style={{ fontSize: '9.5px', letterSpacing: '0.01em' }}
            >
              <div className="font-extrabold" style={{ fontSize: '10.5px', letterSpacing: '0.01em' }}>
                Dr. Pradipta Kundu
              </div>
              <div>MBBS (Hons), MS, DO, DNB, FICO (I)</div>
              <div>Reg. No. : 28873</div>
            </div>

            {/* Center — Logo + label */}
            <div className="flex flex-col items-center" style={{ minWidth: '70px' }}>
              <img
                src="/logo.png"
                alt="MR Logo"
                className="object-contain"
                style={{ width: '60px', height: '40px' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              {/* Fallback circle */}
              <div
                className="rounded-full border-2 border-black bg-gray-200 items-center justify-center flex-col hidden"
                style={{ width: '60px', height: '60px' }}
              >
                <span className="font-black text-black leading-none" style={{ fontSize: '11px' }}>
                  MR
                </span>
              </div>
              <div
                className="text-center font-bold text-black uppercase  underline"
                style={{ fontSize: '12px', letterSpacing: '0.04em' }}
              >
                CONSULTANT EYE SURGEON
              </div>
            </div>

            {/* Right — Dr. Amita */}
            <div
              className="text-black leading-snug text-right"
              style={{ fontSize: '9.5px', letterSpacing: '0.01em' }}
            >
              <div className="font-extrabold" style={{ fontSize: '10.5px', letterSpacing: '0.01em' }}>
                Dr. (Mrs.) Amita Kundu
              </div>
              <div>MBBS, MS, FCLI, FICO (I)</div>
              <div>Reg. No. : 16219</div>
            </div>
          </div>

          {/* ══ NO + DATE ROW ══ */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '2px 4px', letterSpacing: '0.02em' }}
          >
            <div className="whitespace-nowrap font-bold">
              No.:{' '}
              <span
                className="inline-block font-normal border-b border-dotted border-gray-500"
                style={{ minWidth: '55px', paddingBottom: '1px', fontSize: '14px', letterSpacing: '0.03em' }}
              >
                {receiptNo}
              </span>
            </div>
            <div className="text-black" style={{ fontSize: '10px', letterSpacing: '0.02em' }}>
              Date :{' '}
              <span
                className="inline-block font-semibold border-b border-dotted border-gray-500"
                style={{ minWidth: '52px', paddingBottom: '1px', letterSpacing: '0.03em' }}
              >
                {formatDate(date)}
              </span>
            </div>
          </div>

          {/* ══ RECEIVED FROM ══ */}
          <div
            className="flex items-baseline gap-4 mb-1"
            style={{ fontSize: '10px', letterSpacing: '0.02em' }}
          >
            <div className="flex-1 justify-center items-baseline flex">
              <span className="italic font-normal">Received with thanks from :</span>
              <span
                className="inline-block border-b border-dotted border-gray-500 ml-1"
                style={{ minWidth: '120px', paddingBottom: '1px' }}
              >
                {receivedFrom}
              </span>
            </div>
          </div>

          {/* ══ DOTTED ROWS ══ */}
          <DottedRow label="Mr./Mrs." value={name} />
          <DottedRow label="Address" value={address} />
          <DottedRow label="a sum of Rupees" value={amountWords} />
          <DottedRow label="towards" value={purpose} />
          <DottedRow label="Operation / Procedure" value={operation} />
          <DottedRow label="Mode of Payment" value={paymentMode} />

          {/* ══ BOTTOM: AMOUNT BOX + SIGNATURE ══ */}
          <div className="flex items-end justify-between mt-2 pt-1" style={{ marginTop: 'auto' }}>

            {/* Rupee circle + amount box */}
            <div className="flex items-center gap-1">
              <div
                className="border-2 border-black rounded-full flex items-center justify-center font-bold"
                style={{ width: '20px', height: '20px', fontSize: '13px', letterSpacing: '0' }}
              >
                ₹
              </div>
              <div
                className="border-2 border-black font-extrabold text-center rounded-sm"
                style={{ padding: '3px 14px', fontSize: '13px', minWidth: '75px', letterSpacing: '0.03em' }}
              >
                {amount ? Number(amount).toLocaleString('en-IN') : '________'}/—
              </div>
            </div>

            {/* ══ SIGNATURE — image centered above "Signature" text ══ */}
            <div
              className="flex flex-col items-center"
              style={{ fontSize: '9.5px', letterSpacing: '0.02em', width: '90px' }}
            >
              {/* Sign image — centered via flex parent */}
              <img
                src="/sign.png"
                alt="Signature"
                style={{ height: '30px', objectFit: 'contain', display: 'block' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              {/* Fallback blank space if image fails */}
              <div className="hidden" style={{ height: '30px' }} />

              {/* Divider line */}
              <div
                className="border-t border-gray-700 mt-0.5 mb-0.5"
                style={{ width: '90px' }}
              />
              {/* Label */}
              <div className="italic text-center" style={{ letterSpacing: '0.02em' }}>
                Signature
              </div>
            </div>

          </div>

        </div>{/* end inner border */}
      </div>{/* end outer border */}
    </div>
  );
}

function DottedRow({ label, value }) {
  return (
    <div
      className="flex items-baseline mb-1 leading-tight"
      style={{ fontSize: '10px', letterSpacing: '0.02em' }}
    >
      <span
        className="whitespace-nowrap text-black mr-1"
        style={{ minWidth: '110px' }}
      >
        {label} :
      </span>
      <span
        className="flex-1 inline-block border-b border-dotted border-gray-500 text-black"
        style={{ paddingBottom: '1px', minHeight: '13px' }}
      >
        {value}
      </span>
    </div>
  );
}