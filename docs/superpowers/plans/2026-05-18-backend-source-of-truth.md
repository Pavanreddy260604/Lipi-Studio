# Backend Source Of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend synchronization contract that lets the ScriptWriter frontend ask the backend for authoritative project readiness, scene pipeline, quality, snapshot, export, and next-action state.

**Architecture:** Add a focused `projectStatus.service.ts` with a pure summary builder plus a database-backed fetch method. Expose it through `GET /api/script/bible/:id/status`, then add frontend types/API support so later UI work can consume a single source of truth.

**Tech Stack:** Express, Mongoose, TypeScript, Vite frontend service layer.

---

### Task 1: Status Summary Contract

**Files:**
- Create: `backend/scripts/test_project_status.ts`
- Create: `backend/src/services/projectStatus.service.ts`
- Modify: `backend/src/routes/bible.routes.ts`
- Modify: `frontend/src/services/project.api.ts`

- [x] Write an executable test for empty, drafted, reviewed, stale critique, snapshot, and export-ready summary behavior.
- [x] Run the test and confirm it fails because the service does not exist.
- [x] Implement the pure summary builder and database-backed service method.
- [x] Add `GET /api/script/bible/:id/status` before the generic `/:id` route.
- [x] Add frontend `ProjectSyncStatus` types and `projectApi.getProjectStatus`.
- [x] Run backend status test, backend build, and frontend build.
