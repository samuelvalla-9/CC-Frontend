export enum ComplianceRecordType {
  FACILITY = 'FACILITY',
  PATIENT = 'PATIENT',
  EMERGENCY = 'EMERGENCY'
}

export enum ComplianceRecordResult {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  COMPLIANT = 'COMPLIANT',
  NON_COMPLIANT = 'NON_COMPLIANT'
}

export enum AuditStatus {
  INITIATED = 'INITIATED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING'
}

export interface ComplianceRecord {
  complianceId: number;
  entityId: number;
  type: ComplianceRecordType;
  result: ComplianceRecordResult;
  notes?: string;
  recordedBy: number;
  recordedDate: string;
  status?: string;
}

export interface ComplianceRecordRequest {
  entityId: number;
  type: ComplianceRecordType;
  result: ComplianceRecordResult;
  notes?: string;
}

export interface Audit {
  auditId: number;
  scope: string;
  findings?: string;
  status: AuditStatus;
  initiatedBy: number;
  initiatedDate: string;
  completedDate?: string;
}

export interface AuditRequest {
  scope: string;
  findings?: string;
}

export interface AuditLog {
  logId: number;
  auditId: number;
  action: string;
  details?: string;
  timestamp: string;
  performedBy: number;
}
