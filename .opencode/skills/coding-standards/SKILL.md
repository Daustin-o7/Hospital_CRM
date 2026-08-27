---
name: coding-standards
description: Unified Coding-Agent System Prompt covering minimalist coding (Ponytail), frontend & 3D, Python/FastAPI & .NET 10/C# 14 backend, SQL/PostgreSQL engineering, Playwright testing, and security/performance baselines across Antigravity and OpenCode.
---

# Unified Coding-Agent Standards

This skill defines the unified coding philosophy, frontend/3D guidelines, backend patterns (.NET 10 & Python FastAPI), PostgreSQL engineering standards, browser testing, and security baselines.

---

## 1. CORE PHILOSOPHY: MINIMALIST CODING (PONYTAIL RULES)

**Always follow the Ponytail decision ladder before writing code:**

1. Does this code actually need to exist?
2. Can existing project code solve it?
3. Can the standard library solve it?
4. Can the framework/platform solve it natively?
5. Can an already-installed dependency solve it?
6. Can the solution be simpler?
7. Only then write new code.

**Rules:**
- Prefer the smallest correct implementation.
- Do not create abstractions without demonstrated need.
- Do not introduce a dependency for functionality already available in the platform/framework.
- Reuse existing components, utilities, services, hooks, helpers, validators, and patterns.
- Avoid speculative architecture (factories, wrappers, repositories, managers, providers, generic abstractions) unless truly required.
- Do not refactor unrelated code merely because a better style exists.
- Keep APIs, components, and database schemas as simple as practical.
- Minimal does not mean careless: never remove security, validation, accessibility, error handling, observability, or correctness merely to reduce lines of code.

**Implementation Principles:**
- **Less Code > More Code:** Write the smallest functional code possible. Rely on framework features rather than custom abstractions.
- **No Premature Architecture:** Do not build layers (DTOs, Mappers, Repositories) unless explicitly required by project size. Keep things direct and simple.
- **Self-Documenting Code:** Express logic using expressive naming and explicit types rather than inline comments.
- **DRY & Modular:** Keep functions small (under 30 lines where possible), single-purpose, and pure.

**Agent Execution Steps:**
1. **Analyze First:** Read existing codebase patterns before adding new packages or files.
2. **Atomic Changes:** Modify files precisely. Do not rewrite whole files if a minor edit suffices.
3. **Type Safety:** Ensure every function has parameter types and return types explicitly stated.
4. **Error Handling:** Use typed result objects or structured HTTP error payloads instead of silent failures or generic exceptions.
5. **No Placeholders:** Never output `// TODO` or `/* logic here */`. Always provide complete, run-ready code.

---

## 2. FRONTEND & 3D WEB DEVELOPMENT

### Stack & UI Standards
- **Framework:** Next.js (App Router, Server Components by default) or React 19. Use Angular if the project is Angular.
- **Styling:** Tailwind CSS (v4) or modern CSS custom properties with strict utility-first usage. Avoid arbitrary CSS files. If an existing UI library is in use, reuse it instead of adding new ones.
- **State Management:** Zustand or React `useActionState` / `useContext` for lightweight global state. Prefer local state by default.

### Frontend Engineering Skill
- **Architecture:** Component-driven architecture, clear separation of UI/state/data-access concerns, reusable components only where reuse is real, avoid prop drilling when existing state mechanism solves it, avoid global state unless genuinely global.
- **UI Engineering:** Responsive-first development (desktop + tablet + mobile), semantic HTML, WCAG-oriented accessibility (2.1 AA), keyboard navigation, focus management, loading/empty/error states, form validation, disabled/submitting states.
- **Production Quality:** For every user-facing feature, consider: performance, accessibility, responsive behavior, visual hierarchy, error states, loading states, network failure, mobile behavior, browser compatibility.

### Frontend Framework Detection
- **Angular:** When Angular is detected, prioritize: standalone components, signals, computed state, OnPush change detection, Angular DI, Angular routing, HttpClient/interceptors, reactive forms. Do NOT introduce React/Next.js patterns.
- **React:** When React is detected, prioritize: avoid unnecessary re-renders, eliminate request waterfalls, reduce bundle size, stable component architecture, correct async/data-fetching patterns, appropriate memoization, code splitting, server/client boundaries.

### 3D Web Development (Three.js / React Three Fiber)
- **Libraries:** Three.js, `@react-three/fiber` (R3F), `@react-three/drei`, GSAP, Framer Motion. Apply only when 3D creates real product value.
- **Engineering Rules:**
  - Optimize geometry and textures; lazy-load heavy 3D assets.
  - Dispose of geometries, materials, and textures on component unmount.
  - Use `useFrame` only for active animations; avoid heavy operations inside render loops.
  - Optimize 3D models using Draco compression (`.gltf` / `.glb`).
  - Respect `prefers-reduced-motion`; provide fallback content where useful.

---

## 3. BACKEND DEVELOPMENT

### Stack A: Python (FastAPI / Modern Python)
- **Runtime & Syntax:** Python 3.12+ using strict type hints (`mypy` / `pyright` compliant).
- **Framework:** FastAPI with Pydantic v2 for data validation.
- **Async Operations:** Native `async/await` for all I/O, database access, and HTTP calls.
- **Structure:** Single-file or minimal module structure (`routes`, `schemas`, `services`, `models`).
- **FastAPI Defaults:** Typed request models, typed responses, centralized error handling, dependency-based auth, OpenAPI generation, explicit status codes.

### Stack B: .NET 10 & C# 14
- **Style:** Minimal APIs over heavy MVC Controllers (unless project pattern uses Controllers). Use top-level statements for short scripts/services.
- **Language Features:** Modern C# 14 constructs (primary constructors, pattern matching, record types, concise expressions).
- **Data Access:** Entity Framework Core 10 using `DbContext` and Compiled Queries for high performance.
- **Performance:** Use `ValueTask`, `IAsyncEnumerable`, Native AOT compatibility, and zero-allocation memory extensions (`Span<T>`, `Memory<T>`).
- **ASP.NET Core:** Use async APIs appropriately; pass cancellation tokens through I/O-heavy operations; do not block async code with `.Result` or `.Wait()`.

---

## 4. DATABASE & SQL ENGINEERING

### Target Engine
- **PostgreSQL** (with `pgvector` support for AI/embeddings).

### Schema Design
- Third Normal Form (3NF) for transactional data; explicit foreign keys, non-nullable fields by default, and UUID primary keys (`gen_random_uuid()`).
- Include dormant `tenant_id` columns on all tenant-scoped tables for forward-compatible multi-tenancy.

### Query Performance
- Write indexed queries (B-Tree for lookups, GIN for text/JSONB search, HNSW for vector search).
- Avoid `SELECT *`; select only required columns.
- Avoid N+1 ORM queries by projecting DTOs or using explicit eager loading.

### ORM Usage
- Use existing ORM. Do not introduce a second ORM.
- **Python:** SQLAlchemy 2.x + Alembic with explicit `select()` and `async_session`.
- **.NET:** EF Core with `.AsNoTracking()` for read-only queries.

---

## 5. BROWSER / E2E VALIDATION (PLAYWRIGHT)

Use Playwright for browser validation to verify:
- Page rendering, navigation, forms, authentication flows, permissions, API integration, responsive behavior, loading states, error states, multi-role workflows.
- Never claim a feature is verified unless empirically tested.

---

## 6. MCP SERVERS DISCIPLINE

Use MCP intentionally:
- **Context7:** For current, version-specific library documentation.
- **Playwright:** For browser inspection, interactive debugging, UI verification, and screenshots.
- **GitHub:** For repository management, pull requests, and remote metadata.

---

## 7. CONFLICT RESOLUTION

If multiple guidelines overlap, use this priority order:
1. Existing project conventions
2. Explicit user requirements
3. Security / correctness requirements
4. Framework official guidance
5. Language official guidance
6. Specialized skill
7. General best practices

---

## 8. SECURITY & PERFORMANCE BASELINES

- **Security:** Server-side RBAC, input validation, output encoding, SQL injection prevention, CORS configuration, RS256 JWT validation, append-only DB audit logs.
- **Performance:** Frontend page load ≤ 3s, patient search ≤ 2s, indexed queries, async I/O, no request waterfalls.

---

## 9. GIT WORKFLOW CONTROL RULES

1. **User Approval Required:** Never execute `git push` or commit changes automatically without explicit user approval.
2. **Branching Strategy:** Always create a feature branch first before pushing changes to `main`.
3. **User Execution:** Let the user perform Git operations; only execute Git commands when explicitly requested by the user.
