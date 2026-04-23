import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { useVertices, useEdges } from '../spacetime/useKg';
import PageHeader from './PageHeader';
import { Card, CardBody } from '@nextui-org/react';

const ENTITY_COLORS: Record<string, string> = {
  Contact: '#4f46e5',
  Company: '#10b981',
  Deal: '#f59e0b',
  Message: '#8b5cf6',
  Invoice: '#f43f5e',
  Product: '#0ea5e9',
  User: '#6366f1',
  WorkflowRun: '#84cc16',
};

const RELATION_COLORS: Record<string, string> = {
  BelongsTo: '#94a3b8',
  CommunicatedWith: '#4f46e5',
  Purchased: '#10b981',
  WorksAt: '#f59e0b',
  Triggered: '#8b5cf6',
  RelatedTo: '#64748b',
  Paid: '#f43f5e',
};

export default function GraphView() {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);
  const layoutRun = useRef(false);

  const { vertices, isReady: verticesReady } = useVertices();
  const { edges, isReady: edgesReady } = useEdges();

  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cytoscape({
      container: cyRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            label: 'data(label)',
            width: 40, height: 40,
            color: '#fff',
            'text-outline-color': '#1e293b',
            'text-outline-width': 2,
            'font-size': 10,
            'font-family': 'Outfit, sans-serif',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 8,
            'font-family': 'DM Sans, sans-serif',
            'text-outline-color': '#fff',
            'text-outline-width': 1,
            color: '#64748b',
          },
        },
      ],
      layout: { name: 'cose', padding: 10 } as any,
    });

    cyInstance.current = cy;
    return () => { cy.destroy(); };
  }, []);

  useEffect(() => {
    if (!cyInstance.current || !verticesReady || !edgesReady) return;

    const cy = cyInstance.current;
    const validIds = new Set([
      ...vertices.map((v: any) => `v-${v.id}`),
      ...edges.map((e: any) => `e-${e.id}`),
    ]);

    cy.elements().forEach((el: any) => {
      if (!validIds.has(el.id())) cy.remove(el);
    });

    for (const v of vertices) {
      const id = `v-${v.id}`;
      const existing = cy.getElementById(id);
      const color = ENTITY_COLORS[v.entityType.tag] || '#94a3b8';
      const label = `${v.entityType.tag}\n#${v.id}`;
      if (existing.length) {
        existing.data('color', color);
        existing.data('label', label);
      } else {
        cy.add({ data: { id, label, color } });
      }
    }

    for (const e of edges) {
      const id = `e-${e.id}`;
      const existing = cy.getElementById(id);
      const color = RELATION_COLORS[e.relationType.tag] || '#94a3b8';
      const label = e.relationType.tag;
      const data = { id, source: `v-${e.sourceVertexId}`, target: `v-${e.targetVertexId}`, label, color };
      if (existing.length) {
        existing.data(data);
      } else {
        cy.add({ data });
      }
    }

    if (!layoutRun.current) {
      layoutRun.current = true;
      (cy.layout({ name: 'cose', padding: 10, animate: true } as any).run());
    }
  }, [vertices, edges, verticesReady, edgesReady]);

  if (!verticesReady || !edgesReady) {
    return (
      <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
        <PageHeader title="Knowledge Graph" subtitle="Visualize relationships across your CRM data" />
        <Card className="border border-slate-100 shadow-sm min-h-[600px] flex items-center justify-center">
          <CardBody className="text-slate-400 text-sm">Loading graph...</CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Knowledge Graph" subtitle="Visualize relationships across your CRM data" />
      <Card className="border border-slate-100 shadow-sm min-h-[600px]">
        <CardBody className="p-0">
          <div ref={cyRef} style={{ width: '100%', height: '600px' }} />
        </CardBody>
      </Card>
      <p className="text-sm text-slate-400">
        Showing {vertices.length} vertices and {edges.length} edges
      </p>
    </div>
  );
}
