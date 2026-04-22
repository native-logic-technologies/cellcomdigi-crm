import { useState } from 'react';
import { useVertices, useKgReducers } from '../spacetime/useKg';
import type { EntityType } from '../generated/types';

const ENTITY_TYPES: EntityType['tag'][] = [
  'Contact',
  'Company',
  'Deal',
  'Message',
  'Invoice',
  'Product',
  'User',
  'WorkflowRun',
];

export default function VertexList() {
  const [tenantId, setTenantId] = useState<bigint>(1n);
  const [entityFilter, setEntityFilter] = useState<EntityType['tag'] | ''>('');
  const [search, setSearch] = useState('');
  const { vertices, isReady } = useVertices(
    tenantId,
    entityFilter ? ({ tag: entityFilter } as EntityType) : undefined
  );
  const { deleteVertex } = useKgReducers();

  const filtered = vertices.filter((v) => {
    const s = search.toLowerCase();
    return (
      v.sourceTable.toLowerCase().includes(s) ||
      v.properties.toLowerCase().includes(s)
    );
  });

  if (!isReady) return <div className="p-4">Loading vertices...</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Vertices</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={Number(tenantId)}
          onChange={(e) => setTenantId(BigInt(e.target.value))}
          className="border p-2 rounded"
          placeholder="Tenant ID"
        />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value as EntityType['tag'] | '')}
          className="border p-2 rounded"
        >
          <option value="">All Types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded flex-1"
          placeholder="Search..."
        />
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b">
            <th className="p-2">ID</th>
            <th className="p-2">Type</th>
            <th className="p-2">Source</th>
            <th className="p-2">Properties</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v) => (
            <tr key={v.id.toString()} className="border-b hover:bg-gray-100">
              <td className="p-2">{v.id.toString()}</td>
              <td className="p-2">{v.entityType.tag}</td>
              <td className="p-2">
                {v.sourceTable}:{v.sourceId.toString()}
              </td>
              <td className="p-2 max-w-xs truncate">{v.properties}</td>
              <td className="p-2">
                <button
                  onClick={() => deleteVertex({ id: v.id })}
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
