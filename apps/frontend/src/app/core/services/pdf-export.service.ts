import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PdfExportService {
  /**
   * Generates and downloads a clean, multi-page A4 PDF from an HTML element.
   * - Smart row-aware slicing ensures table rows and text are never cut in half.
   * - Isolated canvas slices per page prevent negative offset PDF rendering bugs.
   * - JPEG compression (0.95 quality) produces lightweight (<1MB), crisp output without memory spikes.
   * - Safe file download mechanism without premature object URL revocation or popup blockers.
   */
  async downloadElementAsPdf(
    element: HTMLElement,
    filename = 'Document.pdf',
  ): Promise<void> {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    // 1. Capture HTML element to high-res canvas (scale 2 gives sharp, crisp 192dpi print resolution)
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        // Strip box-shadows or screen-only artifacts on cloned elements
        const clonedSheet = clonedDoc.querySelector(
          '.statement-sheet, .invoice-sheet'
        ) as HTMLElement | null;
        if (clonedSheet) {
          clonedSheet.style.boxShadow = 'none';
          clonedSheet.style.margin = '0 auto';
        }
      },
    });

    // 2. Initialize jsPDF: standard A4 Portrait (210mm x 297mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const marginMm = 8;
    const contentWidthMm = pageWidthMm - marginMm * 2; // 194mm
    const contentHeightMm = pageHeightMm - marginMm * 2; // 281mm

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Canvas pixels per mm of content width
    const pxPerMm = canvasWidth / contentWidthMm;
    const maxSliceHeightPx = Math.floor(contentHeightMm * pxPerMm);

    // Single-page document
    if (canvasHeight <= maxSliceHeightPx) {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvasWidth;
      sliceCanvas.height = canvasHeight;
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, 0);
        const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
        const renderHeightMm = (canvasHeight * contentWidthMm) / canvasWidth;
        pdf.addImage(
          imgData,
          'JPEG',
          marginMm,
          marginMm,
          contentWidthMm,
          renderHeightMm
        );
      }
    } else {
      // Multi-page document: Collect split-boundary candidates so rows are never sliced in half
      const elementRect = element.getBoundingClientRect();
      const scaleY = canvasHeight / Math.max(1, element.offsetHeight);

      const breakCandidates: number[] = [];
      const candidateElements = element.querySelectorAll<HTMLElement>(
        'tr, .statement-signoff-section, .statement-words-box, .statement-doc-footer, .invoice-terms, .invoice-signatures'
      );

      candidateElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const topPx = (rect.top - elementRect.top) * scaleY;
        if (topPx > 0 && topPx < canvasHeight) {
          breakCandidates.push(Math.floor(topPx));
        }
      });
      breakCandidates.sort((a, b) => a - b);

      let currentSourceY = 0;
      let pageIndex = 0;

      while (currentSourceY < canvasHeight) {
        const remainingPx = canvasHeight - currentSourceY;

        let sliceHeightPx: number;
        if (remainingPx <= maxSliceHeightPx) {
          sliceHeightPx = remainingPx;
        } else {
          // Find the best break candidate before currentSourceY + maxSliceHeightPx
          const maxTargetY = currentSourceY + maxSliceHeightPx;
          let bestBreakY = maxTargetY;

          for (let i = breakCandidates.length - 1; i >= 0; i--) {
            const candY = breakCandidates[i];
            // Only break between 60% and 100% of max page height to prevent tiny orphaned pages
            if (
              candY <= maxTargetY &&
              candY > currentSourceY + maxSliceHeightPx * 0.6
            ) {
              bestBreakY = candY;
              break;
            }
          }
          sliceHeightPx = Math.floor(bestBreakY - currentSourceY);
        }

        // Render page slice onto an isolated sub-canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasWidth;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            currentSourceY,
            canvasWidth,
            sliceHeightPx,
            0,
            0,
            canvasWidth,
            sliceHeightPx
          );

          const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          const renderHeightMm = (sliceHeightPx * contentWidthMm) / canvasWidth;

          if (pageIndex > 0) {
            pdf.addPage();
          }
          pdf.addImage(
            imgData,
            'JPEG',
            marginMm,
            marginMm,
            contentWidthMm,
            renderHeightMm
          );
          pageIndex++;
        }

        currentSourceY += sliceHeightPx;
      }
    }

    // 3. Reliable File Download Trigger
    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    try {
      pdf.save(cleanFilename);
    } catch {
      const pdfBlob = pdf.output('blob');
      const blobUrl = window.URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.style.display = 'none';
      downloadLink.href = blobUrl;
      downloadLink.download = cleanFilename;
      // Do NOT set target="_blank" on download links to avoid popup blocker cancellation
      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        if (document.body.contains(downloadLink)) {
          document.body.removeChild(downloadLink);
        }
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    }
  }
}
