# Engineering Skill: System Performance & Optimization (`skills/performance.md`)

This document defines performance standards, response time SLA targets, database query optimization guidelines, frontend rendering rules, and caching policies for SAMSTACK AI.

---

## Purpose

To ensure all backend API endpoints and frontend PWA pages comply with Non-Functional Requirements (NFR) for performance under operational clinic loads.

---

## Scope

Applies to all database queries, API endpoint execution times, React component renders, IndexedDB batching operations, and page load assets.

---

## Verified Information

- **NFR Page Load SLA**: Initial page load ≤ 3 seconds under normal load (§14 NFR baseline).
- **NFR Search Response SLA**: Patient search response (FR-07) ≤ 2 seconds (§14 NFR baseline).
- **Concurrent Scale Target**: Architecture designed to scale modularly up to 500+ concurrent users without redesign (Phase 1 pilot reality: dozens of concurrent users across 3–5 clinics).
- **Polling Standard**: Simple HTTP polling is sufficient for queue updates (FR-11) and live tracking at V1 scale — websockets prohibited in Phase 1 per ponytail discipline.

---

## Implementation Details

### 1. Database Indexing Rules for Performance
- **Patient Search Indexing**:
  - Exact/prefix phone search: B-Tree index `CREATE INDEX idx_patients_phone ON patients(phone);`.
  - Partial name search: Trigram GIN index `CREATE INDEX idx_patients_name_trgm ON patients USING gin (name gin_trgm_ops);`.
- **Daily Queue Lookup**:
  - Composite index `CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, date);`.
- **Invoicing Status Query**:
  - Composite index `CREATE INDEX idx_invoices_status_date ON invoices(status, created_at);`.

### 2. Backend Query Performance Guidelines
- **Always Use `AsNoTracking()` for Read Queries**: Prevent EF Core change tracker overhead on read-only queries.
- **Project DTOs in SQL via `Select()`**: Select only required columns from PostgreSQL rather than loading full entities into memory.
- **Minimum Search Length**: Require at least 3 characters before executing patient name search (FR-07) to avoid full table scans.

### 3. Frontend Optimization
- **Code Splitting**: Dynamic import of route components to keep initial bundle size minimal.
- **Polling Frequency**: Poll schedule endpoint (`GET /api/v1/appointments?date=...`) every 15–30 seconds when tab is active. Pause polling when tab is hidden (`document.hidden`).

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=668-672) — NFR Performance Table
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Scale and polling patterns

---

## Dependencies

- PostgreSQL `pg_trgm` extension
- Entity Framework Core `AsNoTracking` extension

---

## Risks

- **N+1 Query Explosions**: Loading child prescriptions or line items inside loops instead of using `Include()` or projection `Select()`.
- **Unbounded Search Queries**: Returning thousands of patient records when user inputs a 1-character query string.
- **Over-Engineered Infrastructure**: Adding SignalR / Redis Websocket clusters when simple HTTP polling meets SLA requirements.

---

## Future Improvements

- Redis response caching for static clinic profiles and holiday schedules.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Performance testing framework choice (k6 vs Artillery) for load testing pilot release candidate.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=668-672)
