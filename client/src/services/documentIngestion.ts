// Document Ingestion Pipeline
// Client-side text extraction from PDF, DOCX, TXT files

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// PDF.js worker setup — lazy initialisation to avoid top-level await
let pdfWorkerReady = false;
async function initPdfWorker() {
  if (pdfWorkerReady) return;
  const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
    new Blob([pdfjsWorker.default], { type: 'application/javascript' })
  );
  pdfWorkerReady = true;
}

export interface ExtractedDocument {
  title: string;
  contentText: string;
  fileType: string;
}

export async function extractTextFromFile(file: File): Promise<ExtractedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const title = file.name.replace(/\.[^/.]+$/, '');

  if (ext === 'pdf') {
    const text = await extractPdfText(file);
    return { title, contentText: text, fileType: 'pdf' };
  }

  if (ext === 'docx' || ext === 'doc') {
    const text = await extractDocxText(file);
    return { title, contentText: text, fileType: 'docx' };
  }

  if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json') {
    const text = await file.text();
    return { title, contentText: text, fileType: 'txt' };
  }

  // Fallback: try to read as text
  try {
    const text = await file.text();
    return { title, contentText: text, fileType: ext || 'unknown' };
  } catch {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

async function extractPdfText(file: File): Promise<string> {
  await initPdfWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText.trim();
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

export async function generateSummary(text: string): Promise<string> {
  // Simple extractive summary: first 2 sentences + last sentence if long
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  if (sentences.length <= 3) return text.trim();
  return (sentences.slice(0, 2).join(' ') + ' ... ' + sentences[sentences.length - 1]).trim();
}

export function extractKeywords(text: string): string[] {
  // Simple keyword extraction: most frequent non-trivial words
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  const stopwords = new Set(['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'would', 'there', 'could', 'should']);
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (stopwords.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export function buildDocumentMetadata(file: File, pageCount?: number): Record<string, any> {
  return {
    original_name: file.name,
    size_bytes: file.size,
    mime_type: file.type,
    last_modified: file.lastModified,
    pages: pageCount ?? null,
  };
}
