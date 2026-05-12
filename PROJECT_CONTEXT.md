# CityCare Implementation Context (Frontend + Backend)

Last updated: 2026-05-11

---

## 1) Repositories

- Frontend: C:/Users/2478129/Project/CC-Frontend
- Backend: C:/Users/2478129/Project/CC_Microservices

---

## 2) Architecture Snapshot

### Frontend
- Framework: Angular 21 (standalone style)
- Session model: JWT + user object in `sessionStorage`
- Central API entrypoint used by services: `http://localhost:9090` (API Gateway)
- Global interceptors:
  - Attach `Authorization: Bearer <token>`
  - Redirect to `/login` on `401` (except auth login)

### Backend
- Java 21, Spring Boot 3.2.5, Spring Cloud 2023.0.1
- Architecture: microservices + Eureka + Spring Cloud Gateway + OpenFeign
- Config model:
  - Config Server: `http://localhost:8888`
  - ServiceRegistry (Eureka): `http://localhost:8761`
  - API Gateway: `http://localhost:9090`
  - Service-specific properties in `CC_Microservices/config-repo/*.yml`

---

## 3) Backend Modules

- ServiceRegistry
- ConfigServer
- ApiGateway
- AuthService
- CitizenService
- EmergencyService
- FacilityService
- PatientTreatmentService
- ComplianceService
- NotificationService
- jwt-shared-utils

---

## 4) Role Matrix (Source of Truth for UI + API)

- `CITIZEN`
- `DOCTOR`
- `NURSE`
- `DISPATCHER`
- `ADMIN`
- `CITY_HEALTH_OFFICER`
- `COMPLIANCE_OFFICER`

Frontend route mapping currently expected:
- `CITIZEN` -> `/citizen`
- `DOCTOR` -> `/doctor`
- `NURSE` -> `/nurse`
- `DISPATCHER` -> `/dispatcher`
- `ADMIN` -> `/admin`
- `CITY_HEALTH_OFFICER` -> `/officer`
- `COMPLIANCE_OFFICER` -> `/compliance`

---

## 5) Gateway Route Map (Current)

Via API Gateway (`:9090`):
- `/auth/**`, `/admin/**`, `/users/**` -> `AUTHSERVICE`
- `/api/citizens/**` -> `CITIZENSERVICE`
- `/emergencies/**` -> `EMERGENCYSERVICE`
- `/facilities/**`, `/staff/**` -> `FACILITYSERVICE`
- `/patients/**`, `/treatments/**` -> `PATIENTTREATMENTSERVICE`
- `/compliance/**` -> `COMPLIANCESERVICE`
- `/notifications/**` -> `NOTIFICATIONSERVICE`

---

## 6) Frontend Service Contracts (Quick Reference)

All services assume backend response format:
- `ApiResponse<T> = { success: boolean, message: string, data: T }`

Primary Angular API services:
- `AuthService` -> `/auth/login`, `/auth/register`
- `AdminService` -> `/admin/users`, `/admin/staff`, `/admin/dispatchers`, etc.
- `CitizenService` -> `/api/citizens/...`
- `EmergencyService` -> `/emergencies/...`
- `FacilityService` + `AmbulanceService` -> `/facilities/...` and `/emergencies/admin/ambulances...`
- `PatientService` + `TreatmentService` -> `/patients/...` and `/treatments/...`
- `ComplianceService` -> `/compliance/...`
- `NotificationService` -> `/notifications/...`

---

## 7) Core Domain Flow

`Auth/Citizen` -> `Emergency report` -> `Dispatch ambulance` -> `Facility + staff coordination` -> `Patient admit/treatment` -> `Compliance records/audits` -> `Notifications`

---

## 8) Local Run Order (Backend)

Recommended startup order for reliability:
1. `ServiceRegistry` (8761)
2. `ConfigServer` (8888)
3. `ApiGateway` (9090)
4. `AuthService`
5. `CitizenService`
6. `FacilityService`
7. `EmergencyService`
8. `PatientTreatmentService`
9. `ComplianceService`
10. `NotificationService`

---

## 9) Implementation Guardrails (Must Follow)

1. Keep frontend integrated through Gateway (`:9090`), not direct microservice host/ports.
2. Preserve `ApiResponse<T>` envelope unless explicit migration task.
3. Every new UI page must enforce role guard + backend role check.
4. Avoid changing role names; they are shared across JWT, backend security, and UI routing.
5. Prefer extending existing service files over introducing duplicate API clients.
6. For inter-service calls, keep Feign contract DTOs stable and additive.

---

## 10) Known Consistency Notes

1. `config-repo/complianceservice.yml` has a JWT secret shape different from others (`"your-very-secure-secret"` vs base64-style value). Treat as config inconsistency to normalize when handling auth bugs.
2. Frontend manually sets auth headers in services while interceptor also injects token. Keep behavior stable unless a cleanup/refactor task is requested.

---

## 11) Implementation Strategy (Default for New Tasks)

When adding a new feature:
1. Define backend endpoint + role security first.
2. Register route in Gateway if path family is new.
3. Add/extend frontend service method with typed response model.
4. Add/extend component UI + route guard.
5. Validate for role mismatch, payload shape mismatch, and gateway path mismatch.

---

## 12) Working Agreement for Future Changes

Use this file as the first reference before scanning files.
Only deep-search code when:
- endpoint behavior is unclear,
- DTO fields are unknown,
- or there is a regression.

This reduces repeated discovery work and keeps implementation speed consistent.

---

## 13) Dashboard Widget Backlog (Role-wise)

### Delivery Phases

#### Phase 1 (Immediate: frontend + existing APIs)
- Build reusable widget shell components:
  - `kpi-card`
  - `line-chart`
  - `donut-chart`
  - `activity-feed`
  - `pending-queue`
- Ship Admin Overview v1 with currently available data.
- Add role-specific overview sections with card + list widgets first, then charts.

#### Phase 2 (Backend support additions)
- Add aggregated analytics endpoints (weekly/monthly trend endpoints).
- Add centralized activity stream endpoint for cross-service actions.
- Add SLA and risk alert endpoints per role.

#### Phase 3 (Advanced)
- Hotspot visualization (geo/zone)
- Predictive indicators (load and response trends)
- Export/share widgets (PDF/CSV)

---

### A) ADMIN Dashboard Backlog

#### Priority P0 (implement first)
1. Weekly patient admissions trend graph (7 days)
  - Data source now: `/patients`
  - Transform on UI by `admissionDate`/created timestamp.
2. Global recent activity feed
  - Phase 1 source: merge events from existing lists (`users`, `emergencies`, `patients`, `treatments`, `compliance`, `notifications`) sorted by latest timestamp available.
  - Phase 2 source: new backend endpoint `/admin/activity-feed?window=7d`.
3. KPI cards
  - Total emergencies (today/7d)
  - Dispatches (today/7d)
  - Admissions (today/7d)
  - Active users (current)

#### Priority P1
4. Dispatch performance chart
  - Avg dispatch time + dispatch completion trend.
5. Facility load table (top overloaded facilities)
6. Failed/blocked action list (authorization failures, rejected ops)

#### Priority P2
7. Service health mini-panel
8. Role-wise engagement chart (logins/actions by role)

---

### B) CITIZEN Dashboard Backlog

#### Priority P0
1. My health journey timeline
  - Emergency report -> admission -> treatment updates.
2. Verification/profile completion card
3. My notifications panel (unread first)

#### Priority P1
4. My emergency trends (last 30 days)
5. Nearby facilities quick view (availability/basic details)

#### Priority P2
6. Personal response-time insights (my requests)
7. Care adherence reminders (from treatment schedule)

---

### C) DOCTOR Dashboard Backlog

#### Priority P0
1. Assigned patients by status cards
2. Treatments pending/completed trend
3. High-priority patient queue

#### Priority P1
4. Avg treatment completion duration
5. Patients per facility/ward breakdown

#### Priority P2
6. Critical deterioration alerts panel
7. Follow-up due calendar widget

---

### D) NURSE Dashboard Backlog

#### Priority P0
1. Shift workload cards
  - Active patients
  - Tasks due in next 2 hours
2. Unassigned patient queue (for facility)
3. Treatment task completion percentage

#### Priority P1
4. Escalations needing doctor review
5. Handover activity feed (last 8–12 hours)

#### Priority P2
6. Missed/late task trend chart

---

### E) DISPATCHER Dashboard Backlog

#### Priority P0
1. Live emergency queue (pending/dispatched)
2. Available ambulances card + list
3. Dispatch throughput trend (hour/day)

#### Priority P1
4. Response SLA breach alerts
5. Ambulance utilization breakdown

#### Priority P2
6. Zone-wise dispatch heat panel

---

### F) CITY_HEALTH_OFFICER Dashboard Backlog

#### Priority P0
1. City capacity overview
  - Occupancy/load trend
  - Facility status distribution
2. Response SLA by locality table
3. Resource imbalance alerts

#### Priority P1
4. Emergency hotspot trend by zone
5. Facility comparison panel

#### Priority P2
6. Weekly planning recommendations widget

---

### G) COMPLIANCE_OFFICER Dashboard Backlog

#### Priority P0
1. Open audits vs completed audits chart
2. Pending record validations queue
3. Recent compliance actions feed

#### Priority P1
4. Entity risk scoring table
5. Overdue audits panel

#### Priority P2
6. Repeat violation trend chart

---

## 14) Data and API Plan for Activity Feed

### Phase 1 (no backend change)
Create a frontend `ActivityAggregationService` that normalizes into:
- `type` (REGISTER, LOGIN, EMERGENCY_REPORTED, DISPATCHED, ADMITTED, TREATMENT_UPDATED, AUDIT_CREATED, etc.)
- `actorId`
- `actorRole`
- `entityType`
- `entityId`
- `message`
- `timestamp`
- `severity`

Use available timestamps from current response objects; fallback to latest-known fields.

### Phase 2 (backend change)
Add centralized endpoint:
- `GET /admin/activity-feed?from=<iso>&to=<iso>&limit=200`

Backed by event logging from:
- auth events (register/login/activate/deactivate)
- emergency events (report/dispatch/status/release)
- patient/treatment events
- compliance events
- notification events

---

## 15) UI Composition Blueprint (Reusable)

Per dashboard overview use:
1. Row 1: 4 KPI cards
2. Row 2: Main trend chart + secondary breakdown
3. Row 3: Recent activity + pending actions
4. Optional side panel: alerts and SLA breaches

Keep all widgets filter-aware (`today`, `7d`, `30d`, custom range).

---

## 16) Immediate Build Queue (Next Coding Sprint)

1. Admin Overview v1
  - Admissions graph (7d)
  - Global recent activity feed
  - 4 KPI cards
2. Dispatcher Overview v1
  - Pending queue + available ambulances + dispatch trend
3. Compliance Overview v1
  - Pending validations + open/completed audits + activity list

This sequence gives the highest operational value first.