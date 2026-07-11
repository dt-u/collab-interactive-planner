# Collaborative Interactive Planner

## 1. Project Overview

The Collaborative Interactive Planner is a real-time, multi-user co-op travel planning application that enables individuals to plan itineraries, map schedules, and sketch spatial ideas collectively. It combines a structured Kanban-style board representing trip days and itinerary activities with an infinite whiteboard canvas that supports free-form vector drawing, geometric shapes, text inputs, and scaleable image elements. The core business logic revolves around minimizing coordination friction during group trip planning by synchronizing database records (Workspaces, Plans, Comments, Media) and infinite-canvas vector states concurrently.

---

## 2. Discovered Repository Architecture

The project is structured as a monorepo managed via pnpm workspaces. The repository separates backend microservices, real-time gateways, and the frontend single-page application (SPA) under `apps/`, while housing reusable contracts, schema validators, configuration collections, and document syncing engines under `packages/`.

```
collab-interactive-planner/
├── apps/
│   ├── plan-service/           # REST API Gateway (Auth, Workspaces, Comments, Attachments)
│   ├── realtime-service/       # WebSocket Server (Yjs CRDT synchronization, presence, compaction)
│   ├── ai-backend/             # Python-based service for intelligent analysis
│   └── web/                    # React SPA web application compiled with Vite
├── packages/
│   ├── shared/                 # Common interfaces, DTOs, and Zod schemas
│   ├── realtime-protocol/      # Socket contracts and typed events
│   ├── yjs-utils/              # Yjs document initialization, serialization, and vectors
│   ├── tsconfig/               # Shared TypeScript configurations
│   └── eslint-config/          # Shared linting standards
├── infra/                      # Deployment resources (Dockerfiles, Nginx configs, Redis, Mongo)
├── package.json                # Root workspaces configurations
├── pnpm-workspace.yaml         # Monorepo workspaces definition
└── tsconfig.base.json          # Root TypeScript configuration
```

### 2.1 Applications (`apps/`)

* **`plan-service`**: An Express-based HTTP server managing CRUD operations on workspaces, trip boards, comments, user accounts, and media file uploads. It serves as the primary system of record, interacting with MongoDB for transaction data and Redis for authentication session states.
* **`realtime-service`**: A Socket.io WebSocket server handling CRDT state replication. It coordinates real-time user presence updates, tracks collaborative mouse pointer movements, applies binary document updates, and manages baseline snapshot consolidation via a background log compaction worker.
* **`ai-backend`**: A Python-based microservice designed for processing analytical trip tasks.
* **`web`**: A TypeScript-based React SPA built on Vite. It exposes the user dashboard and the infinite planning workspace, using Zustand for local state management and Socket.io-client for real-time channels.

### 2.2 Packages (`packages/`)

* **`shared`**: Defines shared interfaces, domain data transfer objects (DTOs), and Zod validation models to maintain validation parity between client forms and backend request parameters.
* **`realtime-protocol`**: Establishes the exact Socket.io event name enumeration and interface contract binding both the frontend gateway client and the backend WebSocket server.
* **`yjs-utils`**: Houses low-level Yjs initialization helpers, state vector encoders, update payload decoders, and Yjs Shared Map utilities to serialize Y.Doc binary arrays.

---

## 3. Feature Breakdown

### 3.1 Workspace & Plan Management
- Multi-tenant workspace grouping for different planning cohorts or trip directories.
- Collaborative workspace invitations sent via email with user roles (Owner, Admin, Member).
- Instant, non-disruptive workspace list updates through Zustand store versions, eliminating legacy browser page refreshes.

### 3.2 Collaborative Whiteboard & Kanban Board
- Interactive column lanes mapping to itinerary days (e.g. Day 1, Day 2, Day 3) containing structured itinerary activities.
- Double-click renaming, custom Day badge themes, and dynamic right-side cascading placement of new Days at a standard 380px offset.
- Sleek glassmorphic floating quick-navigation index bar for viewport centering onto targeted columns.
- Draggable Kanban items using @dnd-kit to change columns or sequence orders.

### 3.3 Infinite Whiteboard Canvas & Elements
- Free-form vector drawing brush with color swatches and stroke-width selection.
- Eraser tool utilizing AABB-filtered collision detection to delete paths or elements.
- Vector shape inputs (Unfilled/Filled Rectangles, Unfilled/Filled Ellipses, straight Lines, and Arrow connectors).
- Absolute-positioned inline Textarea overlays for direct canvas text insertions.
- Drag-and-drop file ingestion to drop `.png`, `.jpeg`, or `.webp` files, converting them to Base64 image nodes with custom corner-resizing cursor feedback (`nwse-resize`).

### 3.4 Multi-User Presence & Sync
- Multi-client real-time synchronization utilizing Yjs CRDTs.
- Real-time cursor coordinates, active user presence indicators, and color-coded user highlight rings.
- Ephemeral updates (mouse movement) broadcast via WebSockets while bypass-caching the database.

---

## 4. Auto-Detected Tech Stack

| Category | Technology | Usage Location |
| :--- | :--- | :--- |
| Languages | TypeScript (v5.4), JavaScript (ESNext), Python (v3) | Monorepo-wide, ai-worker |
| Frontend Core | React (v18.2), React DOM, React Router DOM (v6.22) | `apps/web` |
| Build Tooling | Vite (v5.1), ESBuild, TSX | `apps/web`, backend dev tooling |
| Backend Core | Express (v4.19), Node.js (v20) | `apps/plan-service` |
| Real-time WebSockets | Socket.io (v4.7), Socket.io-client | `apps/realtime-service`, `apps/web` |
| CRDT Engine | Yjs (v13.6) | `apps/realtime-service`, `apps/web`, `packages/yjs-utils` |
| Database & ORM | MongoDB, Mongoose (v8.2) | `apps/plan-service`, `apps/realtime-service` |
| Cache & Message Broker| Redis, ioredis (v5.3) | `apps/plan-service`, `apps/realtime-service` |
| Socket Clustering | @socket.io/redis-adapter | `apps/realtime-service` |
| Drag and Drop | @dnd-kit (v6.1 - Core, Sortable, Utilities) | `apps/web` |
| UI State Management | Zustand (v4.5) | `apps/web` |
| Form Validation | Zod (v3.22) | `apps/plan-service`, `packages/shared` |
| Icons | Lucide React (v0.344) | `apps/web` |
| HTTP Client | Axios (v1.6) | `apps/web` |
| Test Runner | Vitest (v1.3) | Monorepo-wide |

---

## 5. Local Setup & Execution Guide

### 5.1 Prerequisites
- Node.js (version 20 or higher is recommended)
- pnpm (version 9.0.0 or higher)
- MongoDB instance running locally (port 27017)
- Redis instance running locally (port 6379)

### 5.2 Environment Configuration
Create a `.env` configuration file in the project root directory. Use the structure provided in `.env.example`:

```env
PLAN_SERVICE_PORT=3001
REALTIME_SERVICE_PORT=3002
WEB_PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/collab_planner
REDIS_URI=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-signing-key-here
GOOGLE_CLIENT_ID=your-google-oauth2-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth2-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
GEMINI_API_KEY=your-gemini-api-key-here
```

### 5.3 Installation & Execution Steps

1. **Install workspace dependencies**:
   ```bash
   pnpm install
   ```

2. **Seed development database**:
   Seed the database with pre-configured developer accounts, default workspace channels, and planner boards:
   ```bash
   pnpm --filter @collab-planner/plan-service db:seed
   ```

3. **Run local servers in development mode**:
   Launch the REST API, WebSocket server, and Vite dev compiler concurrently:
   ```bash
   pnpm dev
   ```

4. **Verify compile status**:
   To perform type checks and bundle production-grade assets recursively across the monorepo workspace:
   ```bash
   pnpm build
   ```

5. **Execute test suite**:
   To run integration, unit, and end-to-end testing verification suites:
   ```bash
   pnpm test
   ```
