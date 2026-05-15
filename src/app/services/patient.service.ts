import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Patient, Treatment, PatientStatus, TreatmentStatus } from '../../models/patient.model';
import { ApiResponse } from '../../models/api-response.model';
import { environment } from '../../environments/environment';

export interface AdmitPatientRequest {
  citizenId: number;
  emergencyId: number;
  ward: string;
  notes?: string;
}

export interface TreatmentRequest {
  patientId: number;
  description: string;
  medicationName?: string;
  dosage?: string;
}

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly API = `${environment.apiBaseUrl}/patients`;

  constructor(private http: HttpClient) {}

  admitPatient(request: AdmitPatientRequest): Observable<Patient> {
    return this.http.post<ApiResponse<Patient>>(`${this.API}/admit`, request)
      .pipe(map(res => res.data));
  }

  getAllPatients(): Observable<Patient[]> {
    return this.http.get<ApiResponse<Patient[]>>(this.API)
      .pipe(map(res => res.data));
  }

  getPatientById(id: number): Observable<Patient> {
    return this.http.get<ApiResponse<Patient>>(`${this.API}/${id}`)
      .pipe(map(res => res.data));
  }

  updatePatientStatus(id: number, status: PatientStatus): Observable<Patient> {
    return this.http.patch<ApiResponse<Patient>>(`${this.API}/${id}/status?status=${status}`, {})
      .pipe(map(res => res.data));
  }

  getPatientsByStatus(status: PatientStatus): Observable<Patient[]> {
    return this.http.get<ApiResponse<Patient[]>>(`${this.API}/status/${status}`)
      .pipe(map(res => res.data));
  }

  getPatientsByFacility(facilityId: number): Observable<Patient[]> {
    return this.http.get<ApiResponse<Patient[]>>(`${this.API}/facility/${facilityId}`)
      .pipe(map(res => res.data));
  }

  getUnassignedPatients(): Observable<Patient[]> {
    return this.http.get<ApiResponse<Patient[]>>(`${this.API}/unassigned`)
      .pipe(map(res => res.data));
  }

  getUnassignedPatientsByFacility(facilityId: number): Observable<Patient[]> {
    return this.http.get<ApiResponse<Patient[]>>(`${this.API}/facility/${facilityId}/unassigned`)
      .pipe(map(res => res.data));
  }

  getPatientsByDoctor(doctorId: number): Observable<Patient[]> {
    return this.http.get<ApiResponse<Patient[]>>(`${this.API}/doctor/${doctorId}`)
      .pipe(map(res => res.data));
  }

  getPatientsByFacilityAndDoctor(facilityId: number, doctorId: number): Observable<Patient[]> {
    return this.http.get<ApiResponse<Patient[]>>(`${this.API}/facility/${facilityId}/doctor/${doctorId}`)
      .pipe(map(res => res.data));
  }

  getEmergencyForPatient(id: number): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.API}/${id}/emergency`)
      .pipe(map(res => res.data));
  }
}

@Injectable({ providedIn: 'root' })
export class TreatmentService {
  private readonly API = `${environment.apiBaseUrl}/treatments`;

  constructor(private http: HttpClient) {}

  addTreatment(request: TreatmentRequest): Observable<Treatment> {
    return this.http.post<ApiResponse<Treatment>>(this.API, request)
      .pipe(map(res => res.data));
  }

  getAllTreatments(): Observable<Treatment[]> {
    return this.http.get<ApiResponse<Treatment[]>>(this.API)
      .pipe(map(res => res.data));
  }

  getTreatmentById(id: number): Observable<Treatment> {
    return this.http.get<ApiResponse<Treatment>>(`${this.API}/${id}`)
      .pipe(map(res => res.data));
  }

  getTreatmentsByPatient(patientId: number): Observable<Treatment[]> {
    return this.http.get<ApiResponse<Treatment[]>>(`${environment.apiBaseUrl}/patients/${patientId}/treatments`)
      .pipe(map(res => res.data));
  }

  updateTreatmentStatus(id: number, status: TreatmentStatus): Observable<Treatment> {
    return this.http.patch<ApiResponse<Treatment>>(`${this.API}/${id}/${status}`, {})
      .pipe(map(res => res.data));
  }

  getTreatmentsByDoctorId(doctorId: number): Observable<Treatment[]> {
    return this.http.get<ApiResponse<Treatment[]>>(`${this.API}/assigned-by/${doctorId}`)
      .pipe(map(res => res.data));
  }
}
