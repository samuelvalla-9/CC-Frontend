# Async Action Standard (Admin + Role Dashboards)

## Goal
Prevent stuck UI states, duplicate submissions, and inconsistent error handling for all mutation actions.

## Required Pattern
1. Build an action key (row/bulk/form specific).
2. Guard start with `beginAction(key)` (return if already running).
3. Execute request.
4. Always clean up in `finalize(() => endAction(key))`.
5. Surface user-safe message via `extractErrorMessage(err, fallback)`.
6. Disable corresponding button using `isActionInFlight(key)`.
7. Show progress label (`Updating...`, `Activating...`, etc.).

## Action Key Conventions
- Facility status row: `facility-status:${facilityId}:${status}`
- Facility bulk: `bulk-facility-status:${status}`
- User row/detail: `user:${action}:${userId}`
- User bulk: `bulk-user:${action}`
- Ambulance status: `ambulance-status:${ambulanceId}:${status}`
- Ambulance remove: `ambulance-remove:${ambulanceId}`
- Document verify: `document-verify:${docId}:${status}`
- Patient discharge: `patient-discharge:${patientId}`
- Notifications: `notification-read:${id}`, `notifications-read-all`

## Template Rules
- Every mutation button must include `[disabled]="isActionInFlight(key)"` (plus existing business-condition disables).
- Every mutation button should display a progress label bound to the same key.

## Error Rules
- Never leave raw transport errors in UI.
- Use `extractErrorMessage(err, fallback)` for toast messages.

## Validation
- Try rapid double-click on each mutation action.
- Confirm only one request is sent.
- Confirm button returns to normal on success and failure.
- Confirm error toast is readable.
