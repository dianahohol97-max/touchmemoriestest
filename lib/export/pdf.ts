import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PLReportData } from '@/lib/types/expenses';

// Add Ukrainian font support (optional - for better Cyrillic rendering)
// You may need to add a custom font for proper Ukrainian character rendering

export function exportPLReportToPDF(report: PLReportData, filename: string = 'pl-report.pdf') {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text('P&L ZVIT (Profit & Loss Report)', 14, 20);

  // Period
  doc.setFontSize(12);
  const periodStart = new Date(report.period.start).toLocaleDateString('uk-UA');
  const periodEnd = new Date(report.period.end).toLocaleDateString('uk-UA');
  doc.text(`Period: ${periodStart} - ${periodEnd}`, 14, 30);

  let yPosition = 40;

  // Summary Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PIDSUMOK (Summary)', 14, yPosition);
  yPosition += 10;

  const summaryData = [
    ['Viruchka (Revenue)', formatCurrency(report.revenue.total)],
    ['- Sobivartist (COGS)', `(${formatCurrency(report.expenses.cogs)})`],
    ['= Valoviy pributok (Gross Profit)', formatCurrency(report.profit.gross)],
    ['- Operatsiyni vitraty (Operational Expenses)', `(${formatCurrency(report.expenses.operational.reduce((sum, e) => sum + e.amount, 0))})`],
    ['- Zarplati (Salaries)', `(${formatCurrency(report.expenses.salaries)})`],
    ['= Operatsiyniy pributok (Operational Profit)', formatCurrency(report.profit.operational)],
    ['Marzhinalnist (Margin)', `${report.profit.margin.toFixed(1)}%`],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [['', '']],
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 11 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { halign: 'right', cellWidth: 80 },
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Revenue Breakdown
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DOKHODI (Revenue)', 14, yPosition);
  yPosition += 10;

  const revenueData = [
    ['Zagalna viruchka (Total Revenue)', formatCurrency(report.revenue.total)],
    ...report.revenue.byCategory.map(cat => [
      `  ${cat.category}`,
      formatCurrency(cat.amount),
    ]),
  ];

  autoTable(doc, {
    startY: yPosition,
    body: revenueData,
    theme: 'striped',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: 'right', cellWidth: 80 },
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Check if we need a new page
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  // Expenses Breakdown
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VITRATY (Expenses)', 14, yPosition);
  yPosition += 10;

  const expensesData = [
    ['Sobivartist tovariv (COGS)', formatCurrency(report.expenses.cogs)],
    ...report.expenses.operational.map(exp => [
      `  ${exp.category_name}`,
      formatCurrency(exp.amount),
    ]),
    ['Zarplati (Salaries)', formatCurrency(report.expenses.salaries)],
    ['Zagalni vitraty (Total Expenses)', formatCurrency(report.expenses.total)],
  ];

  autoTable(doc, {
    startY: yPosition,
    body: expensesData,
    theme: 'striped',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: 'right', cellWidth: 80 },
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Monthly Trend
  if (report.monthlyTrend.length > 0) {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('MISYACHNIY TREND (Monthly Trend)', 14, yPosition);
    yPosition += 10;

    const trendData = report.monthlyTrend.map(trend => [
      trend.month,
      formatCurrency(trend.revenue),
      formatCurrency(trend.expenses),
      formatCurrency(trend.profit),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Misyats (Month)', 'Viruchka (Revenue)', 'Vitraty (Expenses)', 'Pributok (Profit)']],
      body: trendData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 139, 202] },
    });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  doc.setFontSize(10);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Storinka ${i} z ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
    doc.text(
      `Zgenerovano: ${new Date().toLocaleString('uk-UA')}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  // Save PDF
  doc.save(filename);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
