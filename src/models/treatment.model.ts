export enum TreatmentStatus {
  PENDING = 'PENDING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface Treatment {
  treatmentId: number;
  patientId: number;
  description: string;
  medicationName?: string;
  dosage?: string;
  assignedBy: number; // Doctor ID
  status: TreatmentStatus;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface TreatmentRequest {
  patientId: number;
  description: string;
  medicationName?: string;
  dosage?: string;
}

export interface TreatmentSummaryResponse {
  treatmentId: number;
  patientId: number;
  status: TreatmentStatus;
  description: string;
  assignedDate: string;
}
