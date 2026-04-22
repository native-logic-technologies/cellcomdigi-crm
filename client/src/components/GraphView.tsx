import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { useVertices, useEdges } from '../spacetime/useKg';

const ENTITY_COLORS: Record<string, string> = {
  Contact: '#3b82f6',
  Company: '#10b981',
  Deal: '#f59e0b',
  Message: '#8b5cf6',
  Invoice: '#ef4444',
  Product: '#06b6d4',
  User: '#6366f1',
  WorkflowRun: '#84cc16',
};

const RELATION_COLORS: Record<string, string> = {
  BelongsTo: '#9ca3af',
  CommunicatedWith: '#3b82f6',
  Purchased: '#10b981',
  WorksAt: '#f59e0b',
  Triggered: '#8b5cf6',
  RelatedTo: '#6b7280',
  Paid: '#ef4444',
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
            width: 40,
            height: 40,
            color: '#fff',
            'text-outline-color': '#000',
            'text-outline-width': 2,
            'font-size': 10,
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
            'text-outline-color': '#fff',
            'text-outline-width': 1,
          },
        },
      ],
      layout: { name: 'cose', padding: 10 } as any,
    });

    cyInstance.current = cy;

    return () => {
      cy.destroy();
    };
  }, []);

  useEffect(() => {
    if (!cyInstance.current || !verticesReady || !edgesReady) return;

    const cy = cyInstance.current;
    const validIds = new Set([
      ...vertices.map((v) => `v-${v.id}`),
      ...edges.map((e) => `e-${e.id}`),
    ]);

    // Remove stale elements
    cy.elements().forEach((el: any) => {
      if (!validIds.has(el.id())) {
        cy.remove(el);
      }
    });

    // Add or update nodes
    for (const v of vertices) {
      const id = `v-${v.id}`;
      const existing = cy.getElementById(id);
      const color = ENTITY_COLORS[v.entityType.tag] || '#999';
      const label = `${v.entityType.tag}\n#${v.id}`;
      if (existing.length) {
        existing.data('color', color);
        existing.data('label', label);
      } else {
        cy.add({ data: { id, label, color } });
      }
    }

    // Add or update edges
    for (const e of edges) {
      const id = `e-${e.id}`;
      const existing = cy.getElementById(id);
      const color = RELATION_COLORS[e.relationType.tag] || '#999';
      const label = e.relationType.tag;
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

    if (!layoutRun.current) {
      layoutRun.current = true;
      (cy.layout({ name: 'cose', padding: 10, animate: true } as any).run());
    }
  }, [vertices, edges, verticesReady, edgesReady]);

  if (!verticesReady || !edgesReady) {
    return <div className="p-4">Loading graph...</div>;
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-2">Graph View</h2>
      <div className="flex-1 border rounded bg-white min-h-[500px]">
        <div ref={cyRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <p className="text-sm text-gray-500 mt-2">
        Showing {vertices.length} vertices and {edges.length} edges
      </p>
    </div>
  );
}
