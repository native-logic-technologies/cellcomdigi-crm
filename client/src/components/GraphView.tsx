import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Graph, NodeEvent, CanvasEvent } from '@antv/g6';
import { useVertices, useEdges } from '../spacetime/useKg';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import PageHeader from './PageHeader';
import {
  Card, CardBody, Button, Input, Badge, Divider, Avatar,
} from '@nextui-org/react';
import {
  Search, ZoomIn, ZoomOut, Maximize, RefreshCw, Filter,
  X, Eye, EyeOff, Network,
} from 'lucide-react';

// ── Entity type colors (CelcomDigi brand palette) ──
const ENTITY_COLORS: Record<string, string> = {
  Contact: '#0078d4', Company: '#10b981', Deal: '#f59e0b', Message: '#8b5cf6',
  Invoice: '#f43f5e', Product: '#0ea5e9', User: '#0087d7', WorkflowRun: '#84cc16',
  Payment: '#ec4899', Activity: '#14b8a6', Conversation: '#a855f7', Document: '#3b82f6',
  Memory: '#fbbf24', Container: '#64748b', ContentFragment: '#22d3ee',
  SocialPost: '#e879f9', SocialCampaign: '#fb923c', Workflow: '#a3e635',
  PipelineStage: '#38bdf8', InvoiceItem: '#f87171',
};

const RELATION_COLORS: Record<string, string> = {
  BelongsTo: '#94a3b8', CommunicatedWith: '#0078d4', Purchased: '#10b981',
  WorksAt: '#f59e0b', Triggered: '#8b5cf6', RelatedTo: '#64748b',
  Paid: '#f43f5e', MentionedIn: '#a855f7', HadActivity: '#14b8a6',
  ParticipatedIn: '#22d3ee', Sent: '#3b82f6', Received: '#0087d7',
  Contains: '#f59e0b', PaidFor: '#ec4899', About: '#fbbf24',
  ExtractedFrom: '#f97316', SimilarTo: '#94a3b8', AuthoredBy: '#84cc16',
  AssignedTo: '#0ea5e9', AtStage: '#38bdf8', InPipeline: '#22d3ee',
  PartOf: '#e879f9', ContainedIn: '#64748b', HasMemory: '#fbbf24',
  HasDocument: '#3b82f6',
};

const INITIAL_NODE_LIMIT = 200;

export default function GraphView() {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  const { vertices, isReady: verticesReady } = useVertices();
  const { edges, isReady: edgesReady } = useEdges();

  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [showContainers, setShowContainers] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const { darkMode } = useTheme();

  // ── Filter & limit vertices ──
  const filteredVertices = useMemo(() => {
    return vertices.filter((v: any) => {
      if (!showContainers && v.entityType?.tag === 'Container') return false;
      if (selectedEntity && v.entityType?.tag !== selectedEntity) return false;
      if (search) {
        const q = search.toLowerCase();
        try {
          const props = JSON.parse(v.properties);
          const text = `${v.entityType?.tag} ${props.name || ''} ${props.title || ''} ${props.email || ''}`.toLowerCase();
          return text.includes(q);
        } catch {
          return v.entityType?.tag?.toLowerCase().includes(q);
        }
      }
      return true;
    });
  }, [vertices, showContainers, selectedEntity, search]);

  const displayVertices = showAll ? filteredVertices : filteredVertices.slice(0, INITIAL_NODE_LIMIT);
  const displayVertexIds = new Set(displayVertices.map((v: any) => String(v.id)));

  // ── Only edges between displayed vertices ──
  const displayEdges = useMemo(() => {
    return edges.filter((e: any) =>
      displayVertexIds.has(String(e.sourceVertexId)) &&
      displayVertexIds.has(String(e.targetVertexId))
    );
  }, [edges, displayVertexIds]);

  // ── Entity counts for filter badges ──
  const entityCounts = useMemo(() => {
    return vertices.reduce((acc: Record<string, number>, v: any) => {
      const tag = v.entityType?.tag || 'Unknown';
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
  }, [vertices]);

  // ── Selected node details ──
  const selectedVertex = useMemo(() => {
    if (!selectedNodeId) return null;
    return displayVertices.find((v: any) => String(v.id) === selectedNodeId) || null;
  }, [selectedNodeId, displayVertices]);

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return displayEdges.filter(
      (e: any) => String(e.sourceVertexId) === selectedNodeId || String(e.targetVertexId) === selectedNodeId
    );
  }, [selectedNodeId, displayEdges]);

  // ── Initialize G6 graph ──
  useEffect(() => {
    if (!containerRef.current || graphRef.current) return;

    const container = containerRef.current;

    const graph = new Graph({
      container,
      width: 1200,
      height: 650,
      autoFit: 'view',
      theme: darkMode ? 'dark' : 'light',
      animation: {
        duration: 300,
        easing: 'ease-in-out-sine',
      },
      layout: {
        type: 'force',
        animation: true,
        preventOverlap: true,
        linkDistance: 120,
        nodeStrength: -200,
        edgeStrength: 0.5,
      },
      node: {
        type: 'circle',
        style: {
          size: (d: any) => {
            const type = d.data?.entityType;
            return type === 'Contact' || type === 'Company' ? 28 : 20;
          },
          fill: (d: any) => ENTITY_COLORS[d.data?.entityType] || '#94a3b8',
          lineWidth: 2,
          stroke: '#ffffff',
          labelText: (d: any) => {
            try {
              const props = JSON.parse(d.data?.properties || '{}');
              return props.title || props.name || props.email || d.data?.entityType;
            } catch {
              return d.data?.entityType;
            }
          },
          labelFontSize: 10,
          labelFill: darkMode ? '#e2e8f0' : '#334155',
          labelBackground: true,
          labelBackgroundFill: '#ffffff',
          labelBackgroundOpacity: 0.85,
          labelBackgroundPadding: [2, 4],
          labelBackgroundRadius: 4,
        },
        state: {
          selected: {
            halo: true,
            haloStroke: '#fbbf24',
            haloLineWidth: 3,
            haloOpacity: 0.6,
            stroke: '#fbbf24',
            lineWidth: 3,
          },
          active: {
            halo: true,
            haloStroke: '#0078d4',
            haloLineWidth: 2,
            haloOpacity: 0.4,
          },
        },
      },
      edge: {
        type: 'quadratic',
        style: {
          stroke: (d: any) => RELATION_COLORS[d.data?.relationType?.tag] || '#94a3b8',
          lineWidth: 1.2,
          endArrow: true,
          endArrowSize: 6,
          labelText: (d: any) => d.data?.relationType?.tag || '',
          labelFontSize: 9,
          labelFill: darkMode ? '#94a3b8' : '#64748b',
          labelBackground: true,
          labelBackgroundFill: '#ffffff',
          labelBackgroundOpacity: 0.8,
          labelBackgroundPadding: [1, 3],
          labelBackgroundRadius: 3,
          curveOffset: 20,
        },
        state: {
          selected: {
            stroke: '#fbbf24',
            lineWidth: 2.5,
            endArrowSize: 8,
          },
          active: {
            stroke: '#0078d4',
            lineWidth: 2,
          },
        },
      },
      behaviors: [
        'zoom-canvas',
        'drag-canvas',
        'drag-element',
        {
          type: 'click-select',
          state: 'selected',
          unselectedState: undefined,
          multiple: false,
        },
        'hover-activate',
      ],
      plugins: [
        {
          type: 'background',
          background: darkMode ? '#0f1f3a' : '#f8fafc',
        },
      ],
    });

    // Listen for node clicks
    graph.on(NodeEvent.CLICK, (event: any) => {
      const nodeId = String(event.target?.id ?? event.item?.id);
      setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
    });

    graph.on(NodeEvent.POINTER_OVER, (event: any) => {
      setActiveNodeId(String(event.target?.id ?? event.item?.id));
    });

    graph.on(NodeEvent.POINTER_OUT, () => {
      setActiveNodeId(null);
    });

    graph.on(CanvasEvent.CLICK, () => {
      setSelectedNodeId(null);
    });

    graphRef.current = graph;

    // Initial render with empty data so canvas is created
    (async () => {
      try {
        graph.setData({ nodes: [], edges: [] });
        await graph.render();
        console.log('[GraphView] Graph initialized');
      } catch (err: any) {
        console.error('Graph init render error:', err);
        setRenderError(err?.message || 'Failed to initialize graph');
      }
    })();

    return () => {
      graph.destroy();
      graphRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync data ──
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !verticesReady || !edgesReady) return;
    console.log('[GraphView] Syncing data:', displayVertices.length, 'nodes,', displayEdges.length, 'edges');

    const nodes = displayVertices.map((v: any) => {
      const entityType = v.entityType?.tag || 'Unknown';
      let title = '';
      try {
        const props = JSON.parse(v.properties);
        title = props.title || props.name || props.email || '';
      } catch { /* ignore */ }

      return {
        id: String(v.id),
        data: { ...v, entityType, title },
        states: selectedNodeId === String(v.id) ? ['selected'] : activeNodeId === String(v.id) ? ['active'] : [],
      };
    });

    const graphEdges = displayEdges.map((e: any) => ({
      id: String(e.id),
      source: String(e.sourceVertexId),
      target: String(e.targetVertexId),
      data: e,
      states: [],
    }));

    (async () => {
      try {
        graph.setData({ nodes, edges: graphEdges });
        await graph.render();
        if (nodes.length > 0) {
          await graph.fitView({}, true);
        }
      } catch (err: any) {
        console.error('Graph data render error:', err);
        setRenderError(err?.message || 'Failed to render graph');
      }
    })();
  }, [displayVertices, displayEdges, verticesReady, edgesReady, selectedNodeId, activeNodeId]);

  // ── Theme change ──
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    try {
      graph.setTheme(darkMode ? 'dark' : 'light');
      graph.setNode({
        style: {
          labelFill: darkMode ? '#e2e8f0' : '#334155',
        },
      });
      graph.setEdge({
        style: {
          labelFill: darkMode ? '#94a3b8' : '#64748b',
        },
      });
      graph.draw().catch(() => {});
    } catch {
      // ignore if theme switch fails
    }
  }, [darkMode]);

  // ── Controls ──
  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoomBy(1.2);
  }, []);

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoomBy(0.8);
  }, []);

  const handleFit = useCallback(() => {
    graphRef.current?.fitView({}, true);
  }, []);

  const handleRefresh = useCallback(() => {
    graphRef.current?.layout();
    setTimeout(() => graphRef.current?.fitView({}, true), 400);
  }, []);

  // ── Loading state ──
  if (!verticesReady || !edgesReady) {
    return (
      <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
        <PageHeader title={t('graph.title')} subtitle={t('graph.subtitle')} />
        <Card className="border border-slate-100 shadow-sm min-h-[600px] flex items-center justify-center">
          <CardBody className="text-slate-400 text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading graph data…
          </CardBody>
        </Card>
      </div>
    );
  }

  const topEntityTypes = Object.entries(entityCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 6);

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title={t('graph.title')} subtitle={t('graph.subtitle')} />

      {/* Toolbar */}
      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="py-3 px-4 flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search nodes…"
            size="sm"
            startContent={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onValueChange={setSearch}
          />

          <div className="flex items-center gap-1.5 flex-wrap">
            {topEntityTypes.map(([type, count]) => {
              const isActive = selectedEntity === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedEntity(isActive ? '' : type)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full ring-1 ring-white"
                    style={{ backgroundColor: ENTITY_COLORS[type] || '#94a3b8' }}
                  />
                  {type}
                  <span className={`${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    {count as number}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showContainers ? 'solid' : 'flat'}
              className="text-xs h-8"
              onPress={() => setShowContainers(!showContainers)}
              startContent={showContainers ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            >
              {showContainers ? 'Hide Containers' : `Containers (${entityCounts['Container'] || 0})`}
            </Button>
            {filteredVertices.length > INITIAL_NODE_LIMIT && (
              <Button
                size="sm"
                variant="flat"
                className="text-xs h-8"
                onPress={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show Less' : `Show All (${filteredVertices.length})`}
              </Button>
            )}
            <Button size="sm" isIconOnly variant="light" className="h-8 w-8" onPress={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" isIconOnly variant="light" className="h-8 w-8" onPress={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button size="sm" isIconOnly variant="light" className="h-8 w-8" onPress={handleFit}>
              <Maximize className="w-4 h-4" />
            </Button>
            <Button size="sm" isIconOnly variant="light" className="h-8 w-8" onPress={handleRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Graph + Details Panel */}
      <div className="relative">
        <Card className="border border-slate-100 shadow-sm overflow-hidden">
          <CardBody className="p-0 relative">
            <div ref={containerRef} style={{ width: '100%', height: '650px' }} />

            {renderError && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90">
                <div className="text-center max-w-sm px-4">
                  <Network className="w-10 h-10 mx-auto mb-2 text-rose-400" />
                  <p className="text-sm text-slate-700 font-medium">Graph failed to load</p>
                  <p className="text-xs text-slate-500 mt-1">{renderError}</p>
                  <Button
                    size="sm"
                    variant="flat"
                    className="mt-3"
                    onPress={() => window.location.reload()}
                  >
                    Reload Page
                  </Button>
                </div>
              </div>
            )}

            {displayVertices.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80">
                <div className="text-center">
                  <Filter className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">No nodes match your filters</p>
                  <Button
                    size="sm"
                    variant="light"
                    className="mt-2"
                    onPress={() => { setSearch(''); setSelectedEntity(''); setShowContainers(true); }}
                  >
                    Clear filters
                  </Button>
                </div>
              </div>
            )}

            {/* Floating stats */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <Badge variant="flat" className="bg-white/90 backdrop-blur text-xs text-slate-600 border border-slate-200">
                <Network className="w-3 h-3 mr-1 text-slate-400" />
                {displayVertices.length} nodes · {displayEdges.length} edges
              </Badge>
              {!showAll && filteredVertices.length > INITIAL_NODE_LIMIT && (
                <Badge variant="flat" className="bg-white/90 backdrop-blur text-xs text-slate-500 border border-slate-200">
                  {filteredVertices.length - INITIAL_NODE_LIMIT} hidden
                </Badge>
              )}
            </div>

            {/* Floating hint */}
            <div className="absolute bottom-3 right-3">
              <Badge variant="flat" className="bg-white/90 backdrop-blur text-[10px] text-slate-400 border border-slate-200">
                Scroll to zoom · Drag to pan · Click to inspect
              </Badge>
            </div>
          </CardBody>
        </Card>

        {/* Selected Node Details Panel */}
        {selectedVertex && (
          <div className="absolute top-4 right-4 w-80 max-h-[580px] overflow-auto">
            <Card className="border border-slate-200 shadow-lg bg-white/95 backdrop-blur">
              <CardBody className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar
                      style={{
                        backgroundColor: `${ENTITY_COLORS[selectedVertex.entityType?.tag] || '#94a3b8'}15`,
                        color: ENTITY_COLORS[selectedVertex.entityType?.tag] || '#94a3b8',
                      }}
                      icon={<Network className="w-4 h-4" />}
                      size="sm"
                    />
                    <div>
                      <h4 className="font-semibold text-sm text-slate-800">
                        {selectedVertex.entityType?.tag}
                      </h4>
                      <p className="text-xs text-slate-500">#{selectedVertex.id.toString()}</p>
                    </div>
                  </div>
                  <Button isIconOnly size="sm" variant="light" className="h-6 w-6 min-w-0" onPress={() => setSelectedNodeId(null)}>
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </Button>
                </div>

                <Divider className="bg-slate-100" />

                {/* Properties */}
                {selectedVertex.properties && (
                  <div className="space-y-1.5">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Properties</h5>
                    <div className="space-y-1">
                      {(() => {
                        try {
                          const props = JSON.parse(selectedVertex.properties);
                          return Object.entries(props)
                            .filter(([, v]) => v !== undefined && v !== null && v !== '')
                            .slice(0, 8)
                            .map(([k, v]) => (
                              <div key={k} className="flex items-start gap-2 text-xs">
                                <span className="text-slate-400 shrink-0 w-20 truncate">{k}</span>
                                <span className="text-slate-700 font-medium truncate">{String(v).slice(0, 40)}</span>
                              </div>
                            ));
                        } catch {
                          return <p className="text-xs text-slate-400">No parseable properties</p>;
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* Connected edges */}
                {selectedNodeEdges.length > 0 && (
                  <>
                    <Divider className="bg-slate-100" />
                    <div className="space-y-1.5">
                      <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Connections ({selectedNodeEdges.length})
                      </h5>
                      <div className="space-y-1 max-h-40 overflow-auto">
                        {selectedNodeEdges.slice(0, 10).map((edge: any) => {
                          const isSource = String(edge.sourceVertexId) === selectedNodeId;
                          const otherId = isSource ? String(edge.targetVertexId) : String(edge.sourceVertexId);
                          const otherVertex = displayVertices.find((v: any) => String(v.id) === otherId);
                          let otherLabel = '';
                          try {
                            const props = JSON.parse(otherVertex?.properties || '{}');
                            otherLabel = props.title || props.name || props.email || otherVertex?.entityType?.tag || otherId;
                          } catch {
                            otherLabel = otherVertex?.entityType?.tag || otherId;
                          }
                          const relationColor = RELATION_COLORS[edge.relationType?.tag] || '#94a3b8';
                          return (
                            <button
                              key={edge.id}
                              onClick={() => setSelectedNodeId(otherId)}
                              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: relationColor }}
                              />
                              <span className="text-[11px] text-slate-500 shrink-0">
                                {isSource ? '→' : '←'} {edge.relationType?.tag}
                              </span>
                              <span className="text-xs text-slate-700 truncate">{otherLabel}</span>
                            </button>
                          );
                        })}
                        {selectedNodeEdges.length > 10 && (
                          <p className="text-[11px] text-slate-400 px-2">
                            +{selectedNodeEdges.length - 10} more connections
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Divider className="bg-slate-100" />

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    className="text-xs h-7 flex-1"
                    onPress={() => {
                      graphRef.current?.focusElement(selectedNodeId!);
                    }}
                  >
                    Center on Node
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    className="text-xs h-7 flex-1"
                    onPress={() => setSelectedNodeId(null)}
                  >
                    Deselect
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
