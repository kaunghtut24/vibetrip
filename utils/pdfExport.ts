import jsPDF from 'jspdf';
import { Itinerary } from '../types';

export const exportItineraryToPDF = (itinerary: Itinerary) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.5); // Return height used
  };

  // ===== HEADER =====
  // Logo/Title
  doc.setFillColor(37, 99, 235); // Blue
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('VibeTrip.AI', margin, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Your Personalized Travel Itinerary', margin, 30);

  yPosition = 50;

  // ===== ITINERARY TITLE =====
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(itinerary.title, margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const descHeight = addWrappedText(itinerary.description, margin, yPosition, contentWidth, 11);
  yPosition += descHeight + 10;

  // ===== SUMMARY BOX =====
  checkPageBreak(40);
  doc.setFillColor(240, 249, 255); // Light blue
  doc.roundedRect(margin, yPosition, contentWidth, 35, 3, 3, 'F');
  
  doc.setDrawColor(191, 219, 254); // Border
  doc.roundedRect(margin, yPosition, contentWidth, 35, 3, 3, 'S');

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  const col1 = margin + 10;
  const col2 = margin + contentWidth / 2;
  
  doc.text('Duration:', col1, yPosition + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${itinerary.days.length} Days`, col1 + 25, yPosition + 12);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Budget:', col1, yPosition + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`${itinerary.currency} ${itinerary.totalEstimatedCost.toLocaleString()}`, col1 + 25, yPosition + 22);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Style:', col2, yPosition + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(itinerary.tags.slice(0, 2).join(', '), col2 + 20, yPosition + 12);

  yPosition += 45;

  // ===== DAILY ITINERARY =====
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Daily Itinerary', margin, yPosition);
  yPosition += 10;

  itinerary.days.forEach((day, dayIdx) => {
    checkPageBreak(50);

    // Day Header
    doc.setFillColor(99, 102, 241); // Indigo
    doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Day ${day.day}: ${day.title}`, margin + 5, yPosition + 8);
    
    yPosition += 18;

    // Activities
    const allActivities = [
      ...day.morning.map(p => ({ ...p, time: 'Morning' })),
      ...day.afternoon.map(p => ({ ...p, time: 'Afternoon' })),
      ...day.evening.map(p => ({ ...p, time: 'Evening' }))
    ];

    allActivities.forEach((place, idx) => {
      checkPageBreak(35);

      // Activity Box
      doc.setDrawColor(229, 231, 235);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(margin + 5, yPosition, contentWidth - 10, 30, 2, 2, 'FD');

      // Time badge
      doc.setFillColor(219, 234, 254);
      doc.roundedRect(margin + 8, yPosition + 3, 25, 6, 1, 1, 'F');
      doc.setFontSize(8);
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.text(place.time, margin + 10, yPosition + 7);

      // Activity name
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(place.name, margin + 8, yPosition + 14);

      // Cost
      doc.setFontSize(10);
      doc.setTextColor(22, 163, 74);
      doc.setFont('helvetica', 'bold');
      doc.text(place.estimatedCost, pageWidth - margin - 30, yPosition + 14);

      // Description
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      doc.setFont('helvetica', 'normal');
      const descText = place.description.substring(0, 100) + (place.description.length > 100 ? '...' : '');
      addWrappedText(descText, margin + 8, yPosition + 20, contentWidth - 20, 9);

      yPosition += 35;
    });

    yPosition += 5;
  });

  // ===== NEXT PAGE: TIPS & BUDGET =====
  doc.addPage();
  yPosition = margin;

  // ===== TRAVEL TIPS =====
  // Note: There are no travelTips in the PlanReasoning type, so this section is removed

  // ===== BUDGET BREAKDOWN =====
  checkPageBreak(60);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('💰 Budget Breakdown', margin, yPosition);
  yPosition += 10;

  // Calculate category totals
  const categoryTotals: { [key: string]: number } = {};
  itinerary.days.forEach(day => {
    [...day.morning, ...day.afternoon, ...day.evening].forEach(place => {
      // Extract numeric value from estimatedCost, handling various currency formats
      const costMatch = place.estimatedCost.match(/[\d.,]+/);
      const cost = costMatch ? parseFloat(costMatch[0].replace(/,/g, '')) : 0;
      categoryTotals[place.type] = (categoryTotals[place.type] || 0) + cost;
    });
  });

  // Budget table header
  doc.setFillColor(37, 99, 235);
  doc.rect(margin, yPosition, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Category', margin + 5, yPosition + 7);
  doc.text('Estimated Cost', pageWidth - margin - 40, yPosition + 7);
  yPosition += 10;

  // Budget rows
  let rowColor = true;
  Object.entries(categoryTotals).forEach(([category, total]) => {
    checkPageBreak(10);

    doc.setFillColor(rowColor ? 249 : 243, rowColor ? 250 : 244, rowColor ? 251 : 245);
    doc.rect(margin, yPosition, contentWidth, 8, 'F');

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.text(category, margin + 5, yPosition + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`${itinerary.currency} ${total.toFixed(2)}`, pageWidth - margin - 40, yPosition + 6);

    yPosition += 8;
    rowColor = !rowColor;
  });

  // Total row
  doc.setFillColor(22, 163, 74);
  doc.rect(margin, yPosition, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL ESTIMATED COST', margin + 5, yPosition + 7);
  doc.text(`${itinerary.currency} ${itinerary.totalEstimatedCost.toLocaleString()}`, pageWidth - margin - 40, yPosition + 7);
  yPosition += 15;

  // Budget note
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin, yPosition, contentWidth, 20, 2, 2, 'F');
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  addWrappedText(
    '⚠️ Note: All prices are estimates and may vary. Please confirm availability and pricing at the time of booking.',
    margin + 5,
    yPosition + 7,
    contentWidth - 10,
    9
  );
  yPosition += 25;

  // ===== WHY THIS PLAN (REASONING) =====
  if (itinerary.reasoning) {
    checkPageBreak(40);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('🎯 Why This Plan?', margin, yPosition);
    yPosition += 10;

    // Vibe Analysis
    if (itinerary.reasoning.vibeAnalysis && itinerary.reasoning.vibeAnalysis.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Vibe Match:', margin, yPosition);
      yPosition += 8;

      itinerary.reasoning.vibeAnalysis.forEach((vibe) => {
        checkPageBreak(15);

        doc.setFillColor(243, 232, 255);
        doc.roundedRect(margin + 5, yPosition, contentWidth - 10, 12, 2, 2, 'F');

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`${vibe.vibe}`, margin + 8, yPosition + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      // Display the first few matched activities
      const activitiesText = vibe.matchedActivities.slice(0, 3).join(', ');
      doc.text(`→ ${activitiesText}`, margin + 8, yPosition + 9);

        yPosition += 14;
      });

      yPosition += 5;
    }

  }

  // ===== FOOTER =====
  const addFooter = (pageNum: number) => {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Generated by VibeTrip.AI | Page ${pageNum}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  };

  // Add footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i);
  }

  // Save the PDF
  const fileName = `${itinerary.title.replace(/[^a-z0-9]/gi, '_')}_Itinerary.pdf`;
  doc.save(fileName);
};
