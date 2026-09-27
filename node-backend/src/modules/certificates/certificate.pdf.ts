import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import type { CertificateProject } from './certificate.types.js';

const INDUSTRY_LABELS: Record<string, string> = {
  food: 'Food Processing',
  textile: 'Textile',
  steel: 'Steel',
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export interface CertificatePdfInput {
  project: CertificateProject;
  certificateNumber: string;
  issuedAt: string;
  verifyUrl: string;
}

/** Render a clearance certificate as a PDF buffer. */
export const renderCertificatePdf = async (input: CertificatePdfInput): Promise<Buffer> => {
  const qrDataUrl = await QRCode.toDataURL(input.verifyUrl, { margin: 1, width: 140 });
  const qrImage = Buffer.from(qrDataUrl.split(',')[1]!, 'base64');

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Border
    doc
      .lineWidth(2)
      .strokeColor('#1e3a5f')
      .rect(
        doc.page.margins.left - 16,
        doc.page.margins.top - 16,
        pageWidth + 32,
        doc.page.height - doc.page.margins.top - doc.page.margins.bottom + 32,
      )
      .stroke();

    doc
      .fillColor('#1e3a5f')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('Industrial Clearance Certificate', { align: 'center' });
    doc
      .moveDown(0.3)
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#555')
      .text('Government of Maharashtra — Single Window Clearance', { align: 'center' });

    doc.moveDown(2);
    doc
      .fillColor('#111')
      .fontSize(12)
      .font('Helvetica')
      .text('This is to certify that the enterprise', { align: 'center' });
    doc
      .moveDown(0.5)
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#1e3a5f')
      .text(input.project.enterpriseName, { align: 'center' });
    doc
      .moveDown(0.5)
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#111')
      .text(
        `has been granted clearance for ${INDUSTRY_LABELS[input.project.industry] ?? input.project.industry} operations in ${input.project.district} district.`,
        { align: 'center' },
      );

    // Details block
    doc.moveDown(2);
    const detailY = doc.y;
    doc.fontSize(10).fillColor('#555').font('Helvetica-Bold');
    doc.text('Certificate Number', doc.page.margins.left, detailY);
    doc.text('Applicant', doc.page.margins.left, detailY + 18);
    doc.text('Issued On', doc.page.margins.left, detailY + 36);
    doc.fillColor('#111').font('Helvetica');
    doc.text(input.certificateNumber, doc.page.margins.left + 130, detailY);
    doc.text(input.project.applicantName, doc.page.margins.left + 130, detailY + 18);
    doc.text(formatDate(input.issuedAt), doc.page.margins.left + 130, detailY + 36);

    // Approvals granted
    doc.moveDown(4);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Clearances granted');
    doc.moveDown(0.5).fontSize(10).font('Helvetica').fillColor('#111');
    for (const approval of input.project.approvals) {
      doc.text(`•  ${approval.title}`);
    }

    // QR + verification footer
    const qrSize = 90;
    const qrX = doc.page.width - doc.page.margins.right - qrSize;
    const qrY = doc.page.height - doc.page.margins.bottom - qrSize - 30;
    doc.image(qrImage, qrX, qrY, { width: qrSize, height: qrSize });
    doc
      .fontSize(8)
      .fillColor('#555')
      .text('Scan to verify', qrX, qrY + qrSize + 2, { width: qrSize, align: 'center' });

    doc
      .fontSize(9)
      .fillColor('#555')
      .text(
        `Verify the authenticity of this certificate at ${input.verifyUrl}`,
        doc.page.margins.left,
        doc.page.height - doc.page.margins.bottom - 24,
        { width: pageWidth - qrSize - 20 },
      );

    doc.end();
  });
};
