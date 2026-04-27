import { useMemo, useState } from 'react';
import { Brain, FileText, Lightbulb, Search, Sparkles, X, Globe } from 'lucide-react';
import { Card, CardBody, Badge, Input, Button } from '@nextui-org/react';
import { useSupermemory } from '../services/supermemory';
import type { KgVertex } from '../generated/types';
import MemoryCreator from './MemoryCreator';
import DocumentUploader from './DocumentUploader';
import { ingestWebsiteUrl } from '../services/sitemapIngestion';
import { saveInsightsFromDocument } from '../services/autoInsight';
import { useDb } from '../spacetime/hooks';

interface SupermemoryPanelProps {
  tenantId: bigint;
  entityTable: string;
  entityId: bigint;
  websiteUrl?: string;
}

function parseProps(v: KgVertex): Record<string, any> {
  try { return JSON.parse(v.properties); } catch { return {}; }
}

export default function SupermemoryPanel({ tenantId, entityTable, entityId, websiteUrl }: SupermemoryPanelProps) {
  const db = useDb();
  const { buildContactContext, buildCompanyContext, vertices, edges, isReady } = useSupermemory(tenantId);
  const [showMemoryCreator, setShowMemoryCreator] = useState(false);
  const [showDocUploader, setShowDocUploader] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState('');

  const context = useMemo(() => {
    if (!isReady) return null;
    if (entityTable === 'contacts') {
      return buildContactContext(entityId, { includeMemories: true, includeDocuments: true });
    }
    if (entityTable === 'companies') {
      return buildCompanyContext(entityId, { includeMemories: true, includeDocuments: true });
    }
    return null;
  }, [isReady, entityTable, entityId, buildContactContext, buildCompanyContext]);

  const container = useMemo(() => {
    if (!isReady) return null;
    return vertices.find(v =>
      v.entityType.tag === 'Container' &&
      v.sourceTable === 'memory_collections' &&
      parseProps(v).raw?.collection_type?.startsWith('Auto') &&
      edges.some(e =>
        e.relationType.tag === 'ContainedIn' &&
        e.sourceVertexId === entityId &&
        e.targetVertexId === v.id
      )
    ) || null;
  }, [isReady, vertices, edges, entityId]);

  const containerContents = useMemo(() => {
    if (!container) return [];
    const memberIds = new Set<bigint>();
    for (const e of edges) {
      if (e.relationType.tag === 'ContainedIn' && e.targetVertexId === container.id) {
        memberIds.add(e.sourceVertexId);
      }
    }
    return vertices.filter(v => memberIds.has(v.id));
  }, [container, vertices, edges]);

  const filteredContents = useMemo(() => {
    if (!searchQuery.trim()) return containerContents;
    const q = searchQuery.toLowerCase();
    return containerContents.filter(v => {
      const props = parseProps(v);
      const text = `${props.title} ${props.summary} ${props.content_text}`.toLowerCase();
      return text.includes(q);
    });
  }, [containerContents, searchQuery]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
        <Sparkles className="w-4 h-4 animate-spin mr-2" /> Loading Memory...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-800">Memory Intelligence</h3>
        </div>
        <div className="flex gap-2">
          {websiteUrl && (
            <Button
              size="sm"
              variant="light"
              isLoading={scraping}
              onPress={async () => {
                if (!db || !websiteUrl) return;
                setScraping(true);
                setScrapeResult('');
                try {
                  await ingestWebsiteUrl(websiteUrl, tenantId, entityTable, entityId, db);
                  setScrapeResult('Website scraped & saved!');
                  // Auto-extract insights
                  const { scrapeUrl } = await import('../services/webScraper');
                  const page = await scrapeUrl(websiteUrl);
                  if (page.content) {
                    const count = await saveInsightsFromDocument(
                      page.content, page.title, tenantId, entityTable, entityId, db
                    );
                    if (count > 0) setScrapeResult(prev => `${prev} ${count} insights extracted.`);
                  }
                } catch (e: any) {
                  setScrapeResult(`Error: ${e.message}`);
                } finally {
                  setScraping(false);
                }
              }}
            >
              <Globe className="w-4 h-4" />
            </Button>
          )}
          <Button size="sm" variant="light" onPress={() => setShowMemoryCreator(v => !v)}>
            <Lightbulb className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="light" onPress={() => setShowDocUploader(v => !v)}>
            <FileText className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {scrapeResult && (
        <div className={`text-xs px-2 py-1 rounded ${scrapeResult.startsWith('Error') ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
          {scrapeResult}
        </div>
      )}

      {showMemoryCreator && (
        <Card className="border border-amber-200 bg-amber-50/30">
          <CardBody className="p-3">
            <MemoryCreator
              tenantId={tenantId}
              targetEntityTable={entityTable}
              targetEntityId={entityId}
              onCreated={() => setShowMemoryCreator(false)}
              onCancel={() => setShowMemoryCreator(false)}
            />
          </CardBody>
        </Card>
      )}

      {showDocUploader && (
        <Card className="border border-brand-200 bg-brand-50/30">
          <CardBody className="p-3">
            <DocumentUploader
              tenantId={tenantId}
              targetEntityTable={entityTable}
              targetEntityId={entityId}
              onUploaded={() => setShowDocUploader(false)}
            />
          </CardBody>
        </Card>
      )}

      {/* Search */}
      <Input
        size="sm"
        placeholder="Search this intelligence..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        startContent={<Search className="w-4 h-4 text-slate-400" />}
        endContent={searchQuery && (
          <button onClick={() => setSearchQuery('')}><X className="w-3 h-3 text-slate-400" /></button>
        )}
      />

      {/* Container stats */}
      {container && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="flat" size="sm" className="bg-brand-50 text-brand-700 border border-brand-200">
            {containerContents.length} items in graph
          </Badge>
          <Badge variant="flat" size="sm" className="bg-slate-50 text-slate-600 border border-slate-200">
            {containerContents.filter(v => v.entityType.tag === 'Memory').length} memories
          </Badge>
          <Badge variant="flat" size="sm" className="bg-slate-50 text-slate-600 border border-slate-200">
            {containerContents.filter(v => v.entityType.tag === 'Document').length} documents
          </Badge>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {filteredContents.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            {searchQuery ? 'No matches found' : 'No memories or documents yet. Add some intelligence!'}
          </div>
        ) : (
          filteredContents.map((item) => {
            const props = parseProps(item);
            return (
              <Card key={item.id.toString()} className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <CardBody className="p-3">
                  <div className="flex items-start gap-2">
                    {item.entityType.tag === 'Memory' && <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                    {item.entityType.tag === 'Document' && <FileText className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />}
                    {item.entityType.tag === 'Activity' && <Sparkles className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                    {item.entityType.tag === 'Message' && <Sparkles className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{props.title || item.entityType.tag}</p>
                      {props.summary && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{props.summary}</p>
                      )}
                      {props.content_text && !props.summary && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{props.content_text.slice(0, 120)}...</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <Badge variant="flat" size="sm" className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200">
                          {item.entityType.tag}
                        </Badge>
                        {props.memory_type && (
                          <Badge variant="flat" size="sm" className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200">
                            {props.memory_type}
                          </Badge>
                        )}
                        {props.keywords?.slice(0, 3).map((k: string) => (
                          <Badge key={k} variant="flat" size="sm" className="text-[10px] bg-brand-50 text-brand-600 border border-brand-200">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>

      {/* Context preview for AI */}
      {context && context.formatted.length > 100 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-slate-600">View AI context preview</summary>
          <pre className="mt-2 p-3 bg-slate-50 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap">
            {context.formatted}
          </pre>
        </details>
      )}
    </div>
  );
}
