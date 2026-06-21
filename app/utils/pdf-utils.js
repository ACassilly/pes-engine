import { PDFDocument } from "pdf-lib";
import fs from "fs";

/**
 * PDF Utilities — PES Engine
 * Handles PDF metadata extraction, form filling, and basic text handling
 * Note: Full text extraction requires pdf-parse or pdfjs-dist (not bundled in airgap)
 */

/**
 * Extract metadata from PDF
 */
export async function extractPDFMetadata(filePath) {
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  
  return {
    pageCount: pdfDoc.getPageCount(),
    title: pdfDoc.getTitle() || null,
    author: pdfDoc.getAuthor() || null,
    subject: pdfDoc.getSubject() || null,
    creator: pdfDoc.getCreator() || null,
    keywords: pdfDoc.getKeywords() || null,
    producer: pdfDoc.getProducer() || null,
    creationDate: pdfDoc.getCreationDate() || null,
    modificationDate: pdfDoc.getModificationDate() || null,
    fileSize: pdfBytes.length,
  };
}

/**
 * Extract page dimensions
 */
export async function extractPageDimensions(filePath) {
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  return pdfDoc.getPages().map((page, index) => ({
    pageNumber: index + 1,
    width: page.getWidth(),
    height: page.getHeight(),
    rotation: page.getRotation(),
  }));
}

/**
 * Fill PDF form fields (for spec sheets, warranty forms, etc.)
 */
export async function fillPDFForm(filePath, outputPath, fieldData) {
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  const form = pdfDoc.getForm();
  
  for (const [fieldName, value] of Object.entries(fieldData)) {
    try {
      const field = form.getField(fieldName);
      if (field) {
        field.setText(String(value));
      }
    } catch (error) {
      console.warn(`[PDF] Could not fill field ${fieldName}:`, error.message);
    }
  }
  
  const filledBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, filledBytes);
  
  return outputPath;
}

/**
 * Merge multiple PDFs into one
 */
export async function mergePDFs(filePaths, outputPath) {
  const mergedPdf = await PDFDocument.create();
  
  for (const filePath of filePaths) {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    
    for (const page of pages) {
      mergedPdf.addPage(page);
    }
  }
  
  const mergedBytes = await mergedPdf.save();
  fs.writeFileSync(outputPath, mergedBytes);
  
  return outputPath;
}

/**
 * Extract text from PDF (placeholder — requires pdf-parse or pdfjs-dist)
 * For airgap, this is a stub that returns metadata only.
 * Install pdf-parse for full text extraction: npm install pdf-parse
 */
export async function extractPDFText(filePath) {
  // Stub: returns metadata without full text extraction
  // To enable full extraction, install pdf-parse and replace this implementation
  const metadata = await extractPDFMetadata(filePath);
  
  return {
    ...metadata,
    text: "[Text extraction requires pdf-parse or pdfjs-dist. Install with: npm install pdf-parse]",
    pages: [],
  };
}

/**
 * Validate PDF file
 */
export function validatePDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    
    // Check PDF magic number: %PDF
    if (buffer.length < 4 || buffer.toString("ascii", 0, 4) !== "%PDF") {
      return { valid: false, error: "Not a valid PDF file (missing %PDF header)" };
    }
    
    // Check file size
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (buffer.length > maxSize) {
      return { valid: false, error: `PDF exceeds maximum size (${maxSize / 1024 / 1024}MB)` };
    }
    
    return { valid: true, size: buffer.length };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Compress PDF (placeholder — requires external library)
 * For airgap, use external tools like Ghostscript or qpdf
 */
export async function compressPDF(filePath, outputPath) {
  // Placeholder: copy file as-is
  // For actual compression, use: qpdf --linearize input.pdf output.pdf
  // Or: gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/default -dNOPAUSE -dQUIET -dBATCH -sOutputFile=output.pdf input.pdf
  fs.copyFileSync(filePath, outputPath);
  return outputPath;
}
