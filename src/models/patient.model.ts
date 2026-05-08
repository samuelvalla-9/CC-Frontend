export enum PatientStatus {
  ADMITTED = 'ADMITTED',
  UNDER_TREATMENT = 'UNDER_TREATMENT',
  UNDER_OBSERVATION = 'UNDER_OBSERVATION',
  STABLE = 'STABLE',
  DISCHARGED = 'DISCHARGED',
  CRITICAL = 'CRITICAL'
}

export enum TreatmentStatus {
  PENDING = 'PENDING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface Patient {
  patientId: number;
  citizenId: number;
  emergencyId: number;
  name?: string;
  facilityId?: number;
  facilityName?: string;
  admissionDate: string;
  dischargeDate?: string;
  ward?: string;
  notes?: string;
  status: PatientStatus;
}

export interface Treatment {
  treatmentId: number;
  patientId: number;
  doctorId?: number;
  assignedById?: number;
  doctorName?: string;
  description: string;
  medicationName?: string;
  dosage?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  status: TreatmentStatus;
  notes?: string;
}
