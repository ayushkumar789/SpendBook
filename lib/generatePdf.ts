import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Transaction, Book, PaymentMethod, PaymentMethodGroupWithMembers } from '../constants/types';
import { getCategoryByKey } from '../constants/categories';
import { getUpiAppByKey } from '../constants/upiApps';

export interface ReportOptions {
  book: Book;
  transactions: Transaction[];
  methods: PaymentMethod[];
  groups: PaymentMethodGroupWithMembers[];
  dateStart: string | null; // 'YYYY-MM-DD' or null
  dateEnd: string | null;
  methodFilter: string | null; // same encoding as book/[id].tsx filter state
}

// ─── helpers ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const inrFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function fmt(amount: number): string {
  return inrFmt.format(amount);
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolvedMethodLabel(methodId: string | null, methods: PaymentMethod[]): string {
  if (!methodId) return 'Cash';
  const m = methods.find((x) => x.id === methodId);
  if (!m) return 'Cash';
  if (m.payment_type === 'UPI') {
    const appName = m.upi_app_is_custom ? m.upi_app_name : getUpiAppByKey(m.upi_app ?? '')?.name;
    const suffix = m.last_four_digits ? ` ••${m.last_four_digits}` : '';
    return `${appName ?? 'UPI'} • ${m.bank_name}${suffix}`;
  }
  return `${m.bank_name}${m.last_four_digits ? ` ••${m.last_four_digits}` : ''}`;
}

function filterLabel(
  methodFilter: string | null,
  methods: PaymentMethod[],
  groups: PaymentMethodGroupWithMembers[],
): string {
  if (!methodFilter) return 'All Methods';
  if (methodFilter === '__cash__') return 'Cash';
  if (methodFilter.startsWith('__grp__:')) {
    const grp = groups.find((g) => g.id === methodFilter.slice(8));
    return grp ? grp.name : 'Group';
  }
  const m = methods.find((x) => x.id === methodFilter);
  return m ? resolvedMethodLabel(m.id, methods) : 'Method';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

// ─── filtering ──────────────────────────────────────────────────────────────

function applyFilters(options: ReportOptions): Transaction[] {
  const { transactions, dateStart, dateEnd, methodFilter, groups } = options;

  return transactions.filter((t) => {
    if (dateStart && t.date < dateStart) return false;
    if (dateEnd && t.date > dateEnd) return false;

    if (!methodFilter) return true;
    if (methodFilter === '__cash__') return !t.payment_method_id && !t.to_payment_method_id;
    if (methodFilter.startsWith('__grp__:')) {
      const grp = groups.find((g) => g.id === methodFilter.slice(8));
      return grp
        ? (t.payment_method_id != null && grp.member_ids.includes(t.payment_method_id)) ||
          (t.to_payment_method_id != null && grp.member_ids.includes(t.to_payment_method_id))
        : true;
    }
    return t.payment_method_id === methodFilter || t.to_payment_method_id === methodFilter;
  });
}

// ─── HTML builder ────────────────────────────────────────────────────────────

function buildHtml(options: ReportOptions, txns: Transaction[]): string {
  const { book, methods, groups, dateStart, dateEnd, methodFilter } = options;

  let cashIn = 0, cashOut = 0;
  txns.forEach((t) => {
    if (t.type === 'in') cashIn += t.amount;
    else if (t.type === 'out') cashOut += t.amount;
  });
  const balance = cashIn - cashOut;

  const dateRangeText =
    dateStart && dateEnd
      ? `${fmtDate(dateStart)} – ${fmtDate(dateEnd)}`
      : dateStart
      ? `From ${fmtDate(dateStart)}`
      : dateEnd
      ? `Up to ${fmtDate(dateEnd)}`
      : 'All Time';

  const methodText = filterLabel(methodFilter, methods, groups);
  const generatedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  // Group by month
  const monthMap: Record<string, Transaction[]> = {};
  txns.forEach((t) => {
    const key = t.date.slice(0, 7);
    if (!monthMap[key]) monthMap[key] = [];
    monthMap[key].push(t);
  });
  const sortedMonths = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));

  let tableRows = '';
  sortedMonths.forEach((monthKey) => {
    const label = monthLabel(monthKey);
    const mTxns = monthMap[monthKey].sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      return d !== 0 ? d : a.order - b.order;
    });
    let mIn = 0, mOut = 0;
    mTxns.forEach((t) => {
      if (t.type === 'in') mIn += t.amount;
      else if (t.type === 'out') mOut += t.amount;
    });

    tableRows += `
      <tr class="month-row">
        <td colspan="6">
          ${esc(label)}
          <span class="month-totals">
            <span class="m-in">+${esc(fmt(mIn))}</span>
            <span class="m-out">-${esc(fmt(mOut))}</span>
          </span>
        </td>
      </tr>`;

    mTxns.forEach((t) => {
      const cat = getCategoryByKey(t.category);
      const isIn = t.type === 'in';
      const isTransfer = t.type === 'transfer';
      const amtClass = isIn ? 'amt-in' : isTransfer ? 'amt-transfer' : 'amt-out';
      const prefix = isIn ? '+' : isTransfer ? '⇄' : '-';
      const pmText = isTransfer
        ? `${esc(resolvedMethodLabel(t.payment_method_id, methods))} → ${esc(resolvedMethodLabel(t.to_payment_method_id, methods))}`
        : esc(resolvedMethodLabel(t.payment_method_id, methods));
      const personNote = t.person || t.note || '—';

      tableRows += `
        <tr>
          <td>${esc(fmtDate(t.date))}</td>
          <td><span class="badge badge-${t.type}">${isIn ? 'IN' : isTransfer ? 'TRANSFER' : 'OUT'}</span></td>
          <td>${esc(cat?.emoji ?? '💰')} ${esc(cat?.label ?? t.category)}</td>
          <td class="${amtClass}">${esc(prefix)} ${esc(fmt(t.amount))}</td>
          <td>${pmText}</td>
          <td>${esc(personNote)}</td>
        </tr>`;
    });
  });

  if (txns.length === 0) {
    tableRows = `<tr><td colspan="6" style="text-align:center;color:#888;padding:28px 8px;">
      No transactions found for the selected filters.</td></tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:12mm 14mm}
  body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:10.5px;color:#1a1a2e;background:#fff}

  .header{
    background:linear-gradient(135deg,#5c2d91 0%,#7c3aed 55%,#8b5cf6 100%);
    color:#fff;padding:18px 22px;border-radius:10px;
    display:flex;justify-content:space-between;align-items:flex-start;
    margin-bottom:16px;
  }
  .app-tag{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.75;margin-bottom:4px}
  .book-title{font-size:21px;font-weight:800;margin-bottom:6px}
  .book-emoji{font-size:22px;margin-right:6px}
  .hdr-meta{font-size:9.5px;opacity:.85;line-height:1.6}
  .hdr-right{text-align:right;min-width:70px}
  .hdr-right .lbl{font-size:8.5px;opacity:.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
  .hdr-right .val{font-size:20px;font-weight:800}

  .cards{display:flex;gap:10px;margin-bottom:16px}
  .card{flex:1;border-radius:8px;padding:11px 13px}
  .card .clbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px}
  .card .cval{font-size:15px;font-weight:800}
  .card-in{background:#dcfce7}.card-in .clbl{color:#166534}.card-in .cval{color:#16a34a}
  .card-out{background:#fee2e2}.card-out .clbl{color:#991b1b}.card-out .cval{color:#dc2626}
  .card-bal{background:#ede9fe}.card-bal .clbl{color:#5b21b6}.card-bal .cval{color:#7c3aed}

  table{width:100%;border-collapse:collapse;font-size:9.5px}
  thead tr{background:#5c2d91;color:#fff}
  thead th{padding:8px 7px;text-align:left;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
  tbody tr{border-bottom:.5px solid #e8e8f0}
  tbody tr:nth-child(even):not(.month-row){background:#f9f9fc}
  tbody td{padding:6.5px 7px;vertical-align:top}

  .month-row td{
    background:#f3f0ff;font-size:10px;font-weight:700;color:#5c2d91;
    padding:7px 10px;border-bottom:1px solid #d8d3f0
  }
  .month-totals{float:right;font-size:9px}
  .m-in{color:#16a34a;margin-right:10px}
  .m-out{color:#dc2626}

  .badge{display:inline-block;padding:2px 5px;border-radius:3px;font-size:7.5px;font-weight:800;letter-spacing:.4px}
  .badge-in{background:#dcfce7;color:#166534}
  .badge-out{background:#fee2e2;color:#991b1b}
  .badge-transfer{background:#ede9fe;color:#5b21b6}

  .amt-in{color:#16a34a;font-weight:700}
  .amt-out{color:#dc2626;font-weight:700}
  .amt-transfer{color:#7c3aed;font-weight:700}

  .footer{margin-top:16px;border-top:1px solid #e0e0ea;padding-top:9px;color:#999;font-size:8.5px;display:flex;justify-content:space-between}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="app-tag">SpendBook Report</div>
    <div class="book-title"><span class="book-emoji">${esc(book.icon_emoji)}</span>${esc(book.name)}</div>
    <div class="hdr-meta">
      ${book.description ? `${esc(book.description)}<br/>` : ''}
      Period: <strong>${esc(dateRangeText)}</strong>&nbsp;&nbsp;·&nbsp;&nbsp;Method: <strong>${esc(methodText)}</strong>
    </div>
  </div>
  <div class="hdr-right">
    <div class="lbl">Transactions</div>
    <div class="val">${txns.length}</div>
  </div>
</div>

<div class="cards">
  <div class="card card-in"><div class="clbl">Cash In</div><div class="cval">${esc(fmt(cashIn))}</div></div>
  <div class="card card-out"><div class="clbl">Cash Out</div><div class="cval">${esc(fmt(cashOut))}</div></div>
  <div class="card card-bal"><div class="clbl">Balance</div><div class="cval">${esc(fmt(balance))}</div></div>
</div>

<table>
  <thead>
    <tr>
      <th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Payment Method</th><th>Person / Note</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

<div class="footer">
  <span>Generated by SpendBook &nbsp;·&nbsp; ${esc(generatedAt)}</span>
  <span>${txns.length} transaction${txns.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${esc(dateRangeText)} &nbsp;·&nbsp; ${esc(methodText)}</span>
</div>

</body>
</html>`;
}

// ─── public API ──────────────────────────────────────────────────────────────

export async function generateAndSharePdf(options: ReportOptions): Promise<void> {
  const txns = applyFilters(options);
  const html = buildHtml(options, txns);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${options.book.name} — SpendBook Report`,
    UTI: 'com.adobe.pdf',
  });
}
