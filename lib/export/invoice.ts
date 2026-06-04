import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { transliterateUk } from '@/lib/shipping/transliterate';

//
// Commercial invoice for international shipments (English, customs-standard).
// Values are presented in EUR (the customer-facing currency for INTL orders),
// derived from the order's FROZEN pricing context (price_multiplier +
// exchange_rate) so the invoice matches what was actually charged. Charge
// itself is always UAH; the UAH grand total is shown for reference.
//
// English-only on purpose: jsPDF's built-in fonts don't render Cyrillic without
// an embedded TTF, and an English commercial invoice with transliterated party
// data is the customs-standard artifact. (Bilingual UA/EN would need a Cyrillic
// font embed — a later add if required.)
//

export interface SellerLegal {
  name_en?: string;
  address_en?: string;
  tax_id?: string;
  iban?: string;
  email?: string;
}

interface OrderItem {
  product_name?: string;
  quantity?: number;
  unit_price?: number; // BASE UAH (pre-markup), as stored on the order
}

interface InvoiceOrder {
  order_number?: string;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: any;
  items?: OrderItem[];
  subtotal?: number;       // marked UAH (goods)
  delivery_cost?: number;  // UAH shipping
  total?: number;          // marked UAH grand total
  price_multiplier?: number;
  exchange_rate?: number | null;
}

const eur = (n: number) => `EUR ${n.toFixed(2)}`;

export function exportCommercialInvoicePDF(
  order: InvoiceOrder,
  seller: SellerLegal,
  rateFallback: number,
) {
  const rate = (order.exchange_rate && order.exchange_rate > 0) ? order.exchange_rate : rateFallback;
  const mult = order.price_multiplier && order.price_multiplier > 0 ? order.price_multiplier : 1;
  const doc = new jsPDF();
  const left = 14;
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('COMMERCIAL INVOICE', left, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const invNo = order.order_number || '—';
  const dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  doc.text(`Invoice No: ${invNo}`, left, y);
  doc.text(`Date: ${dateStr}`, 150, y);
  y += 10;

  // Seller
  doc.setFont('helvetica', 'bold');
  doc.text('Seller / Exporter:', left, y); y += 5;
  doc.setFont('helvetica', 'normal');
  const sellerLines = [
    seller.name_en || 'Diana Hohol (sole proprietor / FOP)',
    seller.address_en || '',
    seller.tax_id ? `Tax ID (RNOKPP): ${seller.tax_id}` : '',
    seller.email ? `Email: ${seller.email}` : '',
  ].filter(Boolean);
  sellerLines.forEach(l => { doc.text(l, left, y); y += 5; });
  y += 3;

  // Buyer (transliterated — customs requires Latin)
  const addr = order.delivery_address || {};
  doc.setFont('helvetica', 'bold');
  doc.text('Buyer / Consignee:', left, y); y += 5;
  doc.setFont('helvetica', 'normal');
  const buyerLines = [
    transliterateUk(order.customer_name),
    [transliterateUk(addr.address), transliterateUk(addr.city), addr.postal].filter(Boolean).join(', '),
    transliterateUk(addr.country),
    (order.customer_phone || '').replace(/\s/g, ''),
  ].filter(Boolean);
  buyerLines.forEach(l => { doc.text(l, left, y); y += 5; });
  y += 4;

  // Line items
  const items = order.items || [];
  const body = items.map((it, i) => {
    const qty = Number(it.quantity) || 1;
    const unitEur = ((Number(it.unit_price) || 0) * mult) / rate;
    return [
      String(i + 1),
      transliterateUk(it.product_name) || 'Photo product',
      String(qty),
      eur(unitEur),
      eur(unitEur * qty),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description (printed photo products)', 'Qty', 'Unit price', 'Amount']],
    body,
    theme: 'striped',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [38, 58, 153] },
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 16 }, 3: { cellWidth: 30 }, 4: { cellWidth: 30 } },
  });

  // Totals (authoritative from frozen order amounts)
  const goodsEur = (Number(order.subtotal) || 0) / rate;
  const shipEur = (Number(order.delivery_cost) || 0) / rate;
  const totalEur = (Number(order.total) || 0) / rate;
  let ty = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.text(`Goods total: ${eur(goodsEur)}`, 130, ty); ty += 6;
  doc.text(`Shipping: ${eur(shipEur)}`, 130, ty); ty += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${eur(totalEur)}`, 130, ty); ty += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`(Charged in UAH: ${Math.round(Number(order.total) || 0)} UAH, rate 1 EUR = ${rate.toFixed(2)} UAH)`, 130, ty);
  ty += 12;

  // Customs footer
  doc.setFontSize(9);
  const footer = [
    'Country of origin: Ukraine.',
    'Reason for export: sale of goods.',
    'The exporter declares that the information on this invoice is true and correct.',
  ];
  if (seller.iban) footer.push(`Bank (IBAN): ${seller.iban}`);
  footer.forEach(l => { doc.text(l, left, ty); ty += 5; });
  ty += 6;
  doc.text('Signature: ____________________', left, ty);

  doc.save(`invoice-${invNo}.pdf`);
}
