// Sitemap Ingestion Service
// Fetch sitemap.xml, parse URLs, scrape each page, save as Document vertices

import { scrapeUrl, parseSitemap } from './webScraper';
import { generateSummary, extractKeywords, buildDocumentMetadata } from './documentIngestion';

export interface IngestProgress {
  total: number;
  completed: number;
  currentUrl: string;
  successCount: number;
  errorCount: number;
}

export type ProgressCallback = (progress: IngestProgress) => void;

/**
 * Ingest a sitemap: scrape each URL and create Document vertices.
 * Processes URLs sequentially to respect rate limits.
 */
export async function ingestSitemap(
  sitemapUrl: string,
  tenantId: bigint,
  db: any,
  onProgress?: ProgressCallback,
  maxUrls = 50
): Promise<{ success: number; errors: number }> {
  if (!db) throw new Error('Database connection not available');

  const urls = await parseSitemap(sitemapUrl);
  const toProcess = urls.slice(0, maxUrls);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const url = toProcess[i];
    onProgress?.({
      total: toProcess.length,
      completed: i,
      currentUrl: url,
      successCount,
      errorCount,
    });

    try {
      const page = await scrapeUrl(url);
      if (!page.content || page.content.length < 100) {
        errorCount++;
        continue;
      }

      const summary = await generateSummary(page.content);
      const keywords = extractKeywords(page.content);
      const metadata = buildDocumentMetadata(
        new File([], page.title || 'scraped-page'),
        undefined
      );
      (metadata as any).source_url = page.url;
      (metadata as any).scrape_source = page.source;

      (db.reducers as any).createDocument({
        tenantId,
        title: page.title || url,
        sourceUrl: page.url,
        contentText: page.content.slice(0, 50000),
        fileType: 'url',
        extractedSummary: summary,
        extractedKeywords: JSON.stringify(keywords),
        metadata: JSON.stringify(metadata),
        uploadedBy: 1n,
        targetEntityTable: undefined,
        targetEntityId: undefined,
      });

      successCount++;

      // Small delay to be polite to target servers
      if (i < toProcess.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    } catch (e) {
      console.error(`Failed to ingest ${url}:`, e);
      errorCount++;
    }
  }

  onProgress?.({
    total: toProcess.length,
    completed: toProcess.length,
    currentUrl: '',
    successCount,
    errorCount,
  });

  return { success: successCount, errors: errorCount };
}

/**
 * Scrape a single website URL and save as Document.
 */
export async function ingestWebsiteUrl(
  url: string,
  tenantId: bigint,
  targetEntityTable: string | undefined,
  targetEntityId: bigint | undefined,
  db: any
): Promise<void> {
  if (!db) throw new Error('Database connection not available');

  const page = await scrapeUrl(url);
  if (!page.content || page.content.length < 100) {
    throw new Error('No meaningful content found at this URL');
  }

  const summary = await generateSummary(page.content);
  const keywords = extractKeywords(page.content);
  const metadata = buildDocumentMetadata(new File([], page.title || 'web-page'), undefined);
  (metadata as any).source_url = page.url;
  (metadata as any).scrape_source = page.source;

  (db.reducers as any).createDocument({
    tenantId,
    title: page.title || url,
    sourceUrl: page.url,
    contentText: page.content.slice(0, 50000),
    fileType: 'url',
    extractedSummary: summary,
    extractedKeywords: JSON.stringify(keywords),
    metadata: JSON.stringify(metadata),
    uploadedBy: 1n,
    targetEntityTable: targetEntityTable ?? undefined,
    targetEntityId: targetEntityId ?? undefined,
  });
}
