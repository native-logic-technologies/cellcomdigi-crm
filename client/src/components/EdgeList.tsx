import { useState } from 'react';
import { useEdges, useKgReducers } from '../spacetime/useKg';

export default function EdgeList() {
  const [tenantId, setTenantId] = useState<bigint>(1n);
  const [vertexFilter, setVertexFilter] = useState('');
  const { edges, isReady } = useEdges(tenantId);
  const { deleteEdge } = useKgReducers();

  const vertexId = vertexFilter ? BigInt(vertexFilter) : undefined;
  const filtered = edges.filter((e) => {
    if (!vertexId) return true;
    return e.sourceVertexId === vertexId || e.targetVertexId === vertexId;
  });

  if (!isReady) return <div className="p-4">Loading edges...</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Edges</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={Number(tenantId)}
          onChange={(e) => setTenantId(BigInt(e.target.value))}
          className="border p-2 rounded"
          placeholder="Tenant ID"
        />
        <input
          type="text"
          value={vertexFilter}
          onChange={(e) => setVertexFilter(e.target.value)}
          className="border p-2 rounded flex-1"
          placeholder="Filter by vertex ID"
        />
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b">
            <th className="p-2">ID</th>
            <th className="p-2">Relation</th>
            <th className="p-2">Source → Target</th>
            <th className="p-2">Weight</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => (
            <tr key={e.id.toString()} className="border-b hover:bg-gray-100">
              <td className="p-2">{e.id.toString()}</td>
              <td className="p-2">{e.relationType.tag}</td>
              <td className="p-2">
                {e.sourceVertexId.toString()} → {e.targetVertexId.toString()}
              </td>
              <td className="p-2">{e.weight ?? '-'}</td>
              <td className="p-2">
                <button
                  onClick={() => deleteEdge({ id: e.id })}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
