export enum NotificationStatus {
  READ = 'READ',
  UNREAD = 'UNREAD'
}

export enum NotificationCategory {
  EMERGENCY = 'EMERGENCY',
  PATIENT = 'PATIENT',
  FACILITY = 'FACILITY',
  COMPLIANCE = 'COMPLIANCE',
  AUTH = 'AUTH',
  TREATMENT = 'TREATMENT'
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS'
}

export interface Notification {
  notificationId: number;
  userId: number;
  entityId: number;
  message: string;
  title?: string;
  category: NotificationCategory;
  status: NotificationStatus;
  createdDate: string;
  readAt?: string;
  recipientEmail?: string;
  channel?: NotificationChannel;
}

export interface NotificationRequest {
  userId: number;
  entityId: number;
  message: string;
  title?: string;
  category: NotificationCategory;
  recipientEmail?: string;
  channel?: NotificationChannel;
}

export interface EmergencyEventRequest {
  emergencyId: number;
  citizenId: number;
  type?: string;
  location?: string;
  dispatcherId?: number;
  eventType: 'REPORTED' | 'DISPATCHED' | 'STATUS_CHANGED' | 'RESOLVED' | string;
  newStatus?: string;
  recipientEmail?: string;
}

export interface PatientEventRequest {
  patientId: number;
  citizenId: number;
  facilityId?: number;
  eventType: 'ADMITTED' | 'DISCHARGED' | 'TREATMENT_ADDED' | 'STATUS_CHANGED' | string;
  newStatus?: string;
  description?: string;
  doctorId?: number;
  recipientEmail?: string;
}

export interface ComplianceEventRequest {
  complianceId: number;
  entityId: number;
  entityType?: string;
  result?: string;
  eventType: 'RECORD_CREATED' | 'AUDIT_CREATED' | 'AUDIT_COMPLETED' | string;
  officerId?: number;
  findings?: string;
  recipientEmail?: string;
}

export interface AuthEventRequest {
  userId: number;
  name?: string;
  role?: string;
  eventType: 'USER_REGISTERED' | 'PASSWORD_CHANGED' | 'ROLE_UPDATED' | string;
  recipientEmail?: string;
}

export interface FacilityEventRequest {
  facilityId: number;
  facilityName?: string;
  eventType: 'FACILITY_ADDED' | 'STAFF_JOINED' | 'CAPACITY_CRITICAL' | string;
  staffId?: number;
  staffRole?: string;
  currentCapacity?: number;
  maxCapacity?: number;
  notifyUserId?: number;
  recipientEmail?: string;
}

export interface DocumentEventRequest {
  documentId: number;
  citizenId: number;
  citizenName?: string;
  eventType: 'DOCUMENT_UPLOADED' | 'DOCUMENT_VERIFIED' | 'DOCUMENT_REJECTED' | string;
}
