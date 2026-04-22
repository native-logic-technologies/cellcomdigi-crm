# CellCom CRM — Knowledge Graph

A full-stack CRM project built on **SpacetimeDB** with a **React + TypeScript** client. The core data model is a **Knowledge Graph** consisting of vertices (entities like Contacts, Companies, Deals) and edges (relationships between them).

## Project Structure

```
cellcomcrm/
├── server/                    # SpacetimeDB TypeScript server module
│   └── spacetimedb/
│       ├── src/
│       │   └── index.ts       # Schema, reducers & graph operations
│       ├── package.json
│       └── tsconfig.json
├── client/                    # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── spacetime/         # Connection config & hooks
│   │   ├── components/        # VertexList, EdgeList, GraphView
│   │   └── generated/         # Auto-generated from server module
│   ├── package.json
│   └── vite.config.ts
├── generate-bindings.sh       # Helper to regenerate client bindings
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [SpacetimeDB CLI](https://spacetimedb.com/docs) ≥ 2.1

## Quick Start

### 1. Start SpacetimeDB locally

```bash
spacetime start
```

### 2. Publish the server module

```bash
cd server/spacetimedb
spacetime publish cellcomcrm
```

### 3. Install & run the client

```bash
cd client
npm install
npm run dev
```

The client will be available at `http://localhost:5173`.

## Server Module

The server is written in **TypeScript** and defines three public tables:

| Table         | Purpose                                    |
|---------------|--------------------------------------------|
| `kg_vertex`   | Entities (Contact, Company, Deal, etc.)    |
| `kg_edge`     | Relationships between entities             |
| `tenant_member` | Identity → tenant mapping for auth       |

### Reducers

| Reducer           | Description                                          |
|-------------------|------------------------------------------------------|
| `createVertex`    | Insert a new vertex                                  |
| `updateVertex`    | Update vertex properties / embedding                 |
| `deleteVertex`    | Delete a vertex (cascades connected edges)           |
| `createEdge`      | Insert a new edge between two vertices               |
| `updateEdge`      | Update edge properties / weight                      |
| `deleteEdge`      | Delete an edge                                       |
| `mergeVertices`   | Merge two vertices and rewire edges                  |
| `findNeighbors`   | Log adjacent vertices for a given vertex             |
| `bfsTraverse`     | BFS traversal from a vertex up to a max depth        |
| `addTenantMember` | Register an identity for a tenant                    |

All mutating reducers enforce **tenant isolation** via the `tenant_member` table.

## Client

The React client uses generated bindings to communicate with SpacetimeDB.

- **VertexList** — Sortable/filterable table of vertices
- **EdgeList** — Table view of edges with source/target info
- **GraphView** — Force-directed graph visualization (Cytoscape.js)

### Environment Variables

| Variable               | Default                  | Description          |
|------------------------|--------------------------|----------------------|
| `VITE_SPACETIME_HOST`  | `http://localhost:3000`  | SpacetimeDB server   |
| `VITE_SPACETIME_DB`    | `cellcomcrm`             | Database name        |

## Regenerating Client Bindings

Whenever you modify the server schema or reducers, regenerate the client types:

```bash
./generate-bindings.sh
```

This runs `spacetime generate --lang typescript` and outputs to `client/src/generated/`.

## Notes

- `properties` columns store JSON as **strings** because `t.json()` is not available in SpacetimeDB 2.1 TS modules. The client should `JSON.stringify` / `JSON.parse` at boundaries.
- `vector_embedding` is an optional array of `f32` with no fixed-length DB constraint; 384 dimensions are expected by convention.
