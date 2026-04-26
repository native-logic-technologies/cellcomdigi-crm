import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { useVertices, useEdges } from '../spacetime/useKg';
import PageHeader from './PageHeader';
import { Card, CardBody, Button, Input } from '@nextui-org/react';
import { Search, ZoomIn, ZoomOut, Maximize, RefreshCw, Filter } from 'lucide-react';

cytoscape.use(fcose);

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
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);

  const { vertices, isReady: verticesReady } = useVertices();
  const { edges, isReady: edgesReady } = useEdges();

  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [layoutRunning, setLayoutRunning] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string>('');

  // Filter vertices
  const filteredVertices = vertices.filter((v: any) => {
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

  const displayVertices = showAll ? filteredVertices : filteredVertices.slice(0, INITIAL_NODE_LIMIT);
  const displayVertexIds = new Set(displayVertices.map((v: any) => `v-${v.id}`));

  // Only include edges between displayed vertices
  const displayEdges = edges.filter((e: any) =>
    displayVertexIds.has(`v-${e.sourceVertexId}`) && displayVertexIds.has(`v-${e.targetVertexId}`)
  );

  // Entity type counts for filter badges
  const entityCounts = vertices.reduce((acc: Record<string, number>, v: any) => {
    const tag = v.entityType?.tag || 'Unknown';
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});

  // Initialize cytoscape
  useEffect(() => {
    if (!cyRef.current || cyInstance.current) return;

    const cy = cytoscape({
      container: cyRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            label: 'data(label)',
            width: 36, height: 36,
            color: '#fff',
            'text-outline-color': '#0f172a',
            'text-outline-width': 2,
            'font-size': 9,
            'font-family': 'Outfit, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 4,
          } as any,
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#fbbf24',
            'border-opacity': 1,
          } as any,
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
            label: 'data(label)',
            'font-size': 7,
            'font-family': 'DM Sans, sans-serif',
            'text-outline-color': '#fff',
            'text-outline-width': 1,
            color: '#64748b',
            'text-background-color': '#fff',
            'text-background-opacity': 0.8,
            'text-background-padding': 2,
            'text-background-shape': 'roundrectangle',
          } as any,
        },
        {
          selector: 'edge:selected',
          style: {
            width: 3,
            'line-color': '#fbbf24',
            'target-arrow-color': '#fbbf24',
          } as any,
        },
      ],
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    cyInstance.current = cy;

    // Click to show details
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      console.log('Node:', node.data());
    });

    return () => {
      cy.destroy();
      cyInstance.current = null;
    };
  }, []);

  // Sync data and run layout
  const runLayout = useCallback((animate = true) => {
    const cy = cyInstance.current;
    if (!cy || displayVertices.length === 0) return;

    setLayoutRunning(true);

    // Remove elements not in current set
    const validIds = new Set([
      ...displayVertices.map((v: any) => `v-${v.id}`),
      ...displayEdges.map((e: any) => `e-${e.id}`),
    ]);
    cy.elements().forEach((el: any) => {
      if (!validIds.has(el.id())) cy.remove(el);
    });

    // Add/update nodes
    for (const v of displayVertices) {
      const id = `v-${v.id}`;
      const existing = cy.getElementById(id);
      const color = ENTITY_COLORS[v.entityType?.tag] || '#94a3b8';
      let title = '';
      try {
        const props = JSON.parse(v.properties);
        title = props.title || props.name || props.email || '';
      } catch { /* ignore */ }
      const label = title ? `${v.entityType?.tag}\n${title.slice(0, 14)}` : `${v.entityType?.tag}\n#${v.id}`;
      if (existing.length) {
        existing.data({ label, color });
      } else {
        cy.add({ data: { id, label, color } });
      }
    }

    // Add/update edges
    for (const e of displayEdges) {
      const id = `e-${e.id}`;
      const existing = cy.getElementById(id);
      const color = RELATION_COLORS[e.relationType?.tag] || '#94a3b8';
      const label = e.relationType?.tag;
      const data = {
        id,
        source: `v-${e.sourceVertexId}`,
        target: `v-${e.targetVertexId}`,
        label,
        color,
      };
      if (existing.length) {
        existing.data(data);
      } else {
        cy.add({ data });
      }
    }

    // Run layout
    requestAnimationFrame(() => {
      const layout = cy.layout({
        name: 'fcose',
        padding: 20,
        animate,
        animationDuration: animate ? 500 : 0,
        fit: true,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 80,
        nodeRepulsion: 4500,
        edgeElasticity: 0.45,
        gravity: 0.25,
        gravityRangeCompound: 1.5,
        gravityCompound: 1.0,
        gravityRange: 3.8,
        samplingType: true,
        sampleSize: 25,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
        tileDisplacement: 15,
        tile: true,
        // Performance optimizations for large graphs
        randomize: false,
        numIter: 2500,
        // Quality vs speed
        quality: 'proof',
      } as any);

      layout.on('layoutstop', () => setLayoutRunning(false));
      layout.run();
    });
  }, [displayVertices, displayEdges]);

  // Run layout when display data changes meaningfully
  useEffect(() => {
    if (!cyInstance.current || !verticesReady || !edgesReady) return;
    runLayout(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayVertices.length, displayEdges.length, verticesReady, edgesReady]);

  const handleZoomIn = () => cyInstance.current?.zoom(cyInstance.current.zoom() * 1.2);
  const handleZoomOut = () => cyInstance.current?.zoom(cyInstance.current.zoom() / 1.2);
  const handleFit = () => cyInstance.current?.fit(undefined, 20);

  if (!verticesReady || !edgesReady) {
    return (
      <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
        <PageHeader title="Knowledge Graph" subtitle="Visualize relationships across your CRM data" />
        <Card className="border border-slate-100 shadow-sm min-h-[600px] flex items-center justify-center">
          <CardBody className="text-slate-400 text-sm">Loading graph data...</CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Knowledge Graph" subtitle="Visualize relationships across your CRM data" />

      {/* Toolbar */}
      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="py-3 px-4 flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search nodes..."
            size="sm"
            startContent={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onValueChange={setSearch}
          />

          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(entityCounts)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 6)
              .map(([type, count]) => (
                <button
                  key={type}
                  onClick={() => setSelectedEntity(selectedEntity === type ? '' : type)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    selectedEntity === type
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ENTITY_COLORS[type] || '#94a3b8' }} />
                  {type} ({count as number})
                </button>
              ))}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {filteredVertices.length > INITIAL_NODE_LIMIT && (
              <Button
                size="sm"
                variant="flat"
                className="text-xs h-8"
                onPress={() => setShowAll(!showAll)}
              >
                {showAll ? `Show Less` : `Show All (${filteredVertices.length})`}
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
            <Button
              size="sm"
              isIconOnly
              variant="light"
              className="h-8 w-8"
              isLoading={layoutRunning}
              onPress={() => runLayout(false)}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Graph */}
      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="p-0 relative">
          <div ref={cyRef} style={{ width: '100%', height: '600px' }} />

          {displayVertices.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <div className="text-center">
                <Filter className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">No nodes match your filters</p>
                <Button size="sm" variant="light" className="mt-2" onPress={() => { setSearch(''); setSelectedEntity(''); }}>
                  Clear filters
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <p>
          Showing <strong className="text-slate-600">{displayVertices.length}</strong> vertices
          and <strong className="text-slate-600">{displayEdges.length}</strong> edges
          {filteredVertices.length > INITIAL_NODE_LIMIT && !showAll && (
            <span> (of {filteredVertices.length} filtered)</span>
          )}
        </p>
        <p>Scroll to zoom · Drag to pan · Click to select</p>
      </div>
    </div>
  );
}
