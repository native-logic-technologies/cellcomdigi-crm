import { useState, useMemo, useCallback } from 'react';
import {
  Brain, FileText, Lightbulb, FolderOpen, Globe,
  Upload, Search, Sparkles,
  ExternalLink, Tag, Database, TrendingUp, Link2, Trash2, Pencil, Calendar
} from 'lucide-react';
import { useTable } from '../spacetime/hooks';
import { useSupermemory } from '../services/supermemory';
import { useDb } from '../spacetime/hooks';
import { ingestWebsiteUrl, ingestSitemap, type IngestProgress } from '../services/sitemapIngestion';
import { saveInsightsFromDocument } from '../services/autoInsight';
import { safeDate, formatRelative } from '../lib/dateUtils';
import DocumentUploader from './DocumentUploader';
import { useLanguage } from '../i18n/LanguageContext';
import PageHeader from './PageHeader';
import {
  Card, CardBody, Tabs, Tab, Input, Button, Badge,
  Progress, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from '@nextui-org/react';

const DEMO_TENANT = 1n;

export default function KnowledgeBase() {
  const { t } = useLanguage();
  const db = useDb();
  const [documents] = useTable('documents');
  const [memories] = useTable('memories');
  const [collections] = useTable('memory_collections');
  const { vertices, edges } = useSupermemory(DEMO_TENANT);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('documents');

  // Ingest modal state
  const [ingestModalOpen, setIngestModalOpen] = useState(false);
  const [ingestType, setIngestType] = useState<'url' | 'sitemap'>('url');
  const [ingestUrl, setIngestUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestProgress, setIngestProgress] = useState<IngestProgress | null>(null);
  const [ingestResult, setIngestResult] = useState<string>('');

  // Auto-extract insights after document creation
  const [lastDocContent, setLastDocContent] = useState<{ text: string; title: string } | null>(null);
  const [extractingInsights, setExtractingInsights] = useState(false);

  // Document edit modal
  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editMetadata, setEditMetadata] = useState('');

  const tenantDocs = useMemo(() =>
    documents.filter((d: any) => d.tenantId === DEMO_TENANT),
    [documents]
  );
  const tenantMemories = useMemo(() =>
    memories.filter((m: any) => m.tenantId === DEMO_TENANT),
    [memories]
  );
  const tenantCollections = useMemo(() =>
    collections.filter((c: any) => c.tenantId === DEMO_TENANT),
    [collections]
  );

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return tenantDocs;
    const q = searchQuery.toLowerCase();
    return tenantDocs.filter((d: any) => {
      const text = `${d.title} ${d.extractedSummary} ${d.fileType}`.toLowerCase();
      return text.includes(q);
    });
  }, [tenantDocs, searchQuery]);

  const filteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return tenantMemories;
    const q = searchQuery.toLowerCase();
    return tenantMemories.filter((m: any) => {
      const text = `${m.title} ${m.content} ${m.memoryType?.tag}`.toLowerCase();
      return text.includes(q);
    });
  }, [tenantMemories, searchQuery]);

  const stats = useMemo(() => {
    const tenantVertices = vertices;
    return {
      totalVertices: tenantVertices.length,
      totalEdges: edges.length,
      documents: tenantDocs.length,
      memories: tenantMemories.length,
      containers: tenantCollections.length,
    };
  }, [vertices, edges, tenantDocs, tenantMemories, tenantCollections]);

  const handleIngest = async () => {
    if (!ingestUrl.trim() || !db) return;
    setIngesting(true);
    setIngestResult('');
    setIngestProgress(null);

    try {
      if (ingestType === 'url') {
        await ingestWebsiteUrl(ingestUrl.trim(), DEMO_TENANT, undefined, undefined, db);
        setIngestResult('Website ingested successfully!');

        // Auto-extract insights
        const page = await import('../services/webScraper').then(m => m.scrapeUrl(ingestUrl.trim()));
        if (page.content) {
          setExtractingInsights(true);
          const count = await saveInsightsFromDocument(
            page.content, page.title, DEMO_TENANT, undefined, undefined, db
          );
          if (count > 0) {
            setIngestResult(prev => `${prev} ${count} insights auto-extracted.`);
          }
          setExtractingInsights(false);
        }
      } else {
        const result = await ingestSitemap(
          ingestUrl.trim(),
          DEMO_TENANT,
          db,
          (p) => setIngestProgress(p),
          30
        );
        setIngestResult(`Sitemap ingested: ${result.success} pages saved, ${result.errors} errors.`);
      }
    } catch (e: any) {
      setIngestResult(`Error: ${e.message}`);
    } finally {
      setIngesting(false);
    }
  };

  const handleDeleteMemory = useCallback((id: bigint) => {
    if (!db) return;
    (db.reducers as any).deleteMemory({ id });
  }, [db]);

  const handleDeleteDocument = useCallback((id: bigint) => {
    if (!db) return;
    if (!confirm('Delete this document?')) return;
    (db.reducers as any).deleteDocument({ id });
  }, [db]);

  const openEditDocument = (d: any) => {
    setEditDoc(d);
    setEditTitle(d.title || '');
    setEditSummary(d.extractedSummary || '');
    const kw = JSON.parse(d.extractedKeywords || '[]');
    setEditKeywords(Array.isArray(kw) ? kw.join(', ') : '');
    setEditMetadata(d.metadata || '{}');
  };

  const saveEditDocument = () => {
    if (!db || !editDoc) return;
    const keywordsArr = editKeywords.split(',').map((k: string) => k.trim()).filter(Boolean);
    (db.reducers as any).updateDocument({
      id: editDoc.id,
      title: editTitle,
      extracted_summary: editSummary,
      extracted_keywords: JSON.stringify(keywordsArr),
      metadata: editMetadata,
    });
    setEditDoc(null);
  };

  const handleDocUploaded = useCallback(async () => {
    if (!db || !lastDocContent) return;
    setExtractingInsights(true);
    try {
      const count = await saveInsightsFromDocument(
        lastDocContent.text,
        lastDocContent.title,
        DEMO_TENANT,
        undefined,
        undefined,
        db
      );
      if (count > 0) {
        // toast would go here
      }
    } catch (e) {
      console.error('Insight extraction failed:', e);
    } finally {
      setExtractingInsights(false);
      setLastDocContent(null);
    }
  }, [db, lastDocContent]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title={t('knowledgebase.title')}
        subtitle={t('knowledgebase.subtitle')}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Vertices', value: stats.totalVertices, icon: Database, color: 'text-brand-600' },
          { label: 'Edges', value: stats.totalEdges, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Documents', value: stats.documents, icon: FileText, color: 'text-blue-600' },
          { label: 'Memories', value: stats.memories, icon: Lightbulb, color: 'text-amber-600' },
          { label: 'Containers', value: stats.containers, icon: FolderOpen, color: 'text-slate-600' },
        ].map((s) => (
          <Card key={s.label} className="border border-slate-100 shadow-sm">
            <CardBody className="p-3 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-lg font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Search + ingest */}
      <div className="flex gap-3">
        <Input
          placeholder="Search documents, memories, containers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          startContent={<Search className="w-4 h-4 text-slate-400" />}
          className="flex-1"
        />
        <Button
          color="primary"
          startContent={<Globe className="w-4 h-4" />}
          onPress={() => { setIngestModalOpen(true); setIngestType('url'); }}
        >
          Scrape URL
        </Button>
        <Button
          variant="flat"
          startContent={<Link2 className="w-4 h-4" />}
          onPress={() => { setIngestModalOpen(true); setIngestType('sitemap'); }}
        >
          Sitemap
        </Button>
      </div>

      <Tabs selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as string)}>
        <Tab key="documents" title={<span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> Documents</span>}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <div className="lg:col-span-2 space-y-3">
              {filteredDocs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No documents yet. Upload a file or scrape a website.
                </div>
              ) : (
                filteredDocs.map((d: any) => {
                  const keywords = JSON.parse(d.extractedKeywords || '[]');
                  const created = safeDate(d.createdAt);
                  const updated = safeDate(d.updatedAt);
                  return (
                    <Card key={d.id.toString()} className="border border-slate-100 shadow-sm">
                      <CardBody className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                              <h4 className="text-sm font-semibold text-slate-800 truncate">{d.title}</h4>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{d.fileType} · {d.contentText.length.toLocaleString()} chars</p>
                            {d.extractedSummary && (
                              <p className="text-xs text-slate-600 mt-2 line-clamp-2">{d.extractedSummary}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {keywords.slice(0, 5).map((k: string) => (
                                <Badge key={k} variant="flat" size="sm" className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200">
                                  {k}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                              {created && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Added {formatRelative(created)}
                                </span>
                              )}
                              {updated && updated.getTime() !== created?.getTime() && (
                                <span>· Updated {formatRelative(updated)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              className="text-slate-400 hover:text-brand-600 h-7 w-7 min-w-0"
                              onPress={() => openEditDocument(d)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {d.sourceUrl && (
                              <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 inline-flex">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              className="text-slate-400 hover:text-rose-600 h-7 w-7 min-w-0"
                              onPress={() => handleDeleteDocument(d.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })
              )}
            </div>
            <div>
              <Card className="border border-slate-100 shadow-sm">
                <CardBody className="p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-brand-600" /> Upload Document
                  </h3>
                  <DocumentUploader
                    tenantId={DEMO_TENANT}
                    onUploaded={handleDocUploaded}
                  />
                  {extractingInsights && (
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <Sparkles className="w-3 h-3 animate-spin" />
                      Extracting insights with AI...
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </Tab>

        <Tab key="memories" title={<span className="flex items-center gap-1.5"><Lightbulb className="w-4 h-4" /> Memories</span>}>
          <div className="space-y-3 mt-4">
            {filteredMemories.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No memories yet. They are created automatically when documents are uploaded, or manually from contact/company drawers.
              </div>
            ) : (
              filteredMemories.map((m: any) => (
                <Card key={m.id.toString()} className="border border-slate-100 shadow-sm">
                  <CardBody className="p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className={`w-4 h-4 mt-0.5 shrink-0 ${m.memoryType?.tag === 'Insight' ? 'text-amber-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-800">{m.title}</h4>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="text-slate-400 hover:text-rose-600 h-7 w-7 min-w-0 shrink-0"
                            onPress={() => handleDeleteMemory(m.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{m.content}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="flat" size="sm" className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200">
                            {m.memoryType?.tag}
                          </Badge>
                          {m.sourceTable && (
                            <Badge variant="flat" size="sm" className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200">
                              <Tag className="w-3 h-3 mr-0.5" /> {m.sourceTable}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        </Tab>

        <Tab key="containers" title={<span className="flex items-center gap-1.5"><FolderOpen className="w-4 h-4" /> Containers</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {tenantCollections.map((c: any) => {
              const isAuto = c.collectionType?.tag?.startsWith('Auto');
              return (
                <Card key={c.id.toString()} className={`border shadow-sm ${isAuto ? 'border-brand-200 bg-brand-50/20' : 'border-slate-100'}`}>
                  <CardBody className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className={`w-4 h-4 ${isAuto ? 'text-brand-600' : 'text-slate-500'}`} />
                      <h4 className="text-sm font-semibold text-slate-800">{c.name}</h4>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{c.description}</p>
                    <Badge variant="flat" size="sm" className="mt-2 text-[10px] bg-slate-50 text-slate-500 border border-slate-200">
                      {c.collectionType?.tag}
                    </Badge>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </Tab>

        <Tab key="ingest" title={<span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> Ingest</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card className="border border-slate-100 shadow-sm">
              <CardBody className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand-600" /> Scrape Website
                </h3>
                <p className="text-xs text-slate-500">Paste any URL. We'll extract the article text and save it to the knowledge graph.</p>
                <Input
                  placeholder="https://example.com/about-us"
                  value={ingestType === 'url' ? ingestUrl : ''}
                  onChange={(e) => { setIngestType('url'); setIngestUrl(e.target.value); }}
                />
                <Button
                  color="primary"
                  onPress={handleIngest}
                  isLoading={ingesting && ingestType === 'url'}
                  isDisabled={!ingestUrl.trim() || ingesting}
                >
                  Scrape & Save
                </Button>
              </CardBody>
            </Card>

            <Card className="border border-slate-100 shadow-sm">
              <CardBody className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-600" /> Import Sitemap
                </h3>
                <p className="text-xs text-slate-500">Paste a sitemap.xml URL. We'll crawl every page and ingest them as documents.</p>
                <Input
                  placeholder="https://example.com/sitemap.xml"
                  value={ingestType === 'sitemap' ? ingestUrl : ''}
                  onChange={(e) => { setIngestType('sitemap'); setIngestUrl(e.target.value); }}
                />
                <Button
                  color="primary"
                  className="bg-emerald-600"
                  onPress={handleIngest}
                  isLoading={ingesting && ingestType === 'sitemap'}
                  isDisabled={!ingestUrl.trim() || ingesting}
                >
                  Import Sitemap
                </Button>
                {ingestProgress && ingestType === 'sitemap' && (
                  <div className="space-y-2">
                    <Progress size="sm" value={(ingestProgress.completed / ingestProgress.total) * 100} />
                    <p className="text-xs text-slate-500">
                      {ingestProgress.completed}/{ingestProgress.total} · {ingestProgress.successCount} saved · {ingestProgress.errorCount} errors
                    </p>
                    {ingestProgress.currentUrl && (
                      <p className="text-[10px] text-slate-400 truncate">{ingestProgress.currentUrl}</p>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            {ingestResult && (
              <div className={`md:col-span-2 p-3 rounded-lg text-sm ${ingestResult.startsWith('Error') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {ingestResult}
              </div>
            )}
          </div>
        </Tab>
      </Tabs>

      {/* Ingest modal (alternative to inline) */}
      <Modal isOpen={ingestModalOpen} onOpenChange={setIngestModalOpen}>
        <ModalContent>
          <ModalHeader>Import to Knowledge Base</ModalHeader>
          <ModalBody className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={ingestType === 'url' ? 'solid' : 'light'} onPress={() => setIngestType('url')}>
                <Globe className="w-4 h-4 mr-1" /> URL
              </Button>
              <Button size="sm" variant={ingestType === 'sitemap' ? 'solid' : 'light'} onPress={() => setIngestType('sitemap')}>
                <Link2 className="w-4 h-4 mr-1" /> Sitemap
              </Button>
            </div>
            <Input
              placeholder={ingestType === 'url' ? 'https://example.com' : 'https://example.com/sitemap.xml'}
              value={ingestUrl}
              onChange={(e) => setIngestUrl(e.target.value)}
            />
            {ingestProgress && ingestType === 'sitemap' && (
              <Progress size="sm" value={(ingestProgress.completed / ingestProgress.total) * 100} />
            )}
            {ingestResult && (
              <p className={`text-xs ${ingestResult.startsWith('Error') ? 'text-rose-600' : 'text-emerald-600'}`}>{ingestResult}</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIngestModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={handleIngest} isLoading={ingesting} isDisabled={!ingestUrl.trim()}>
              {ingesting ? 'Importing...' : 'Import'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Document Modal */}
      <Modal isOpen={!!editDoc} onOpenChange={() => setEditDoc(null)}>
        <ModalContent>
          <ModalHeader className="font-outfit">Edit Document</ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Summary</label>
              <Input value={editSummary} onChange={(e) => setEditSummary(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Keywords (comma separated)</label>
              <Input value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} placeholder="e.g. fibre, broadband, pricing" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Metadata (JSON)</label>
              <Input value={editMetadata} onChange={(e) => setEditMetadata(e.target.value)} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setEditDoc(null)}>Cancel</Button>
            <Button color="primary" onPress={saveEditDocument} isDisabled={!editTitle.trim()}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
