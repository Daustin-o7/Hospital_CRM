# Engineering Skill: React 19 & Frontend PWA Development Standards (`skills/react.md`)

This document defines frontend development standards, component structure, state management, IndexedDB offline sync, and mobile-first PWA guidelines for SAMSTACK AI using React 19.

---

## Purpose

To guide AI assistants and developers on building fast, responsive, offline-tolerant, accessible React 19 frontend interfaces optimized for front-desk devices and doctor mobile/tablet views.

---

## Scope

Applies to all React 19 components, custom hooks, PWA Service Workers, IndexedDB sync queues, forms, styling, and client API communication.

---

## Verified Information

- **Framework**: React 19 (JavaScript / TypeScript, Vite bundler)
- **Application Type**: Responsive Progressive Web App (PWA)
- **Styling Standard**: Vanilla CSS / modern CSS custom properties (TailwindCSS prohibited unless explicitly confirmed by user)
- **Offline Storage**: IndexedDB (mandatory for FR-22 offline queues; `localStorage` strictly forbidden for offline sync queues)
- **Design Target**: Mobile-first responsive layout (optimized for phones, tablets, and front-desk monitors)

---

## Implementation Details

### 1. IndexedDB Offline Queue Pattern (FR-22)
Use IndexedDB (e.g. via `idb` wrapper or native `indexedDB` API) to store pending patient registrations and billing requests when offline.

```javascript
// Example IndexedDB queue helper for FR-22
import { openDB } from 'idb';

const DB_NAME = 'samstack_offline_db';
const STORE_NAME = 'sync_queue';

export async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
      }
    },
  });
}

export async function enqueueOfflineAction(actionType, payload) {
  const db = await getDb();
  const idempotencyKey = crypto.randomUUID();
  const item = {
    idempotencyKey,
    actionType, // 'REGISTER_PATIENT' | 'CREATE_INVOICE'
    payload,
    timestamp: new Date().toISOString()
  };
  await db.put(STORE_NAME, item);
  return idempotencyKey;
}
```

### 2. Component Layout & Form Discipline
- **Minimal Registration Forms (FR-06)**: Keep required fields to max 3 (Name, Phone, DOB/Age). Add optional details in expandable sections to avoid front-desk friction ("fear of training").
- **Vanilla CSS Tokens**: Use root CSS variables for themes and colors (e.g. `--color-primary`, `--color-surface`, `--color-text`). Avoid generic unstyled elements.
- **Server Role Respect**: Do not rely solely on hiding UI buttons for security. Always handle HTTP 403 Forbidden responses gracefully with clear user feedback.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=621-640) — FR-22 Offline Sync specs
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md#line=24-28) — IndexedDB offline sync reference

---

## Dependencies

- React 19 / React-DOM 19
- Vite build tool
- `idb` IndexedDB helper library

---

## Risks

- **Using Synchronous localStorage for Queues**: Blocking main thread or exceeding 5MB quota by using `localStorage` instead of `IndexedDB`.
- **Heavy UI Overhead**: Loading heavy UI libraries that slow down mobile page load time beyond the 3s NFR limit.
- **Lost Offline Mutations**: Failing to send client-generated idempotency keys with retried requests on reconnect.

---

## Future Improvements

- PWA background sync registration using `ServiceWorkerRegistration.sync`.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Selection of specific React router library (React Router v7 vs TanStack Router) for single-page app navigation.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=621-640)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md)
