import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { Patient, Treatment, PatientStatus, TreatmentStatus } from '../../models/patient.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

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
  private readonly API = 'http://localhost:9090/patients';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  admitPatient(request: AdmitPatientRequest): Observable<Patient> {
    return this.http.post<ApiResponse<Patient>>(`${this.API}/admit`, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllPatients(): Observable<Patient[]> {
    return this.http.get<ApiResponse<Patient[]>>(this.API, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getPatientById(id: number): Observable<Patient> {
    return this.http.get<ApiResponse<Patient>>(`${this.API}/${id}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  updatePatientStatus(id: number, status: PatientStatus): Observable<Patient> {
    return this.http.patch<ApiResponse<Patient>>(`${this.API}/${id}/status?status=${status}`, {}, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getPatientsByStatus(status: PatientStatus): Observable<Patient[]> {
    return this.http.get<ApiResponse<Patient[]>>(`${this.API}/status/${status}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getEmergencyForPatient(id: number): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.API}/${id}/emergency`, { headers: this.headers })
      .pipe(map(res => res.data));
  }
}

@Injectable({ providedIn: 'root' })
export class TreatmentService {
  private readonly API = 'http://localhost:9090/treatments';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  addTreatment(request: TreatmentRequest): Observable<Treatment> {
    return this.http.post<ApiResponse<Treatment>>(this.API, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllTreatments(): Observable<Treatment[]> {
    return this.http.get<ApiResponse<Treatment[]>>(this.API, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getTreatmentById(id: number): Observable<Treatment> {
    return this.http.get<ApiResponse<Treatment>>(`${this.API}/${id}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getTreatmentsByPatient(patientId: number): Observable<Treatment[]> {
    return this.http.get<ApiResponse<Treatment[]>>(`http://localhost:9090/patients/${patientId}/treatments`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  updateTreatmentStatus(id: number, status: TreatmentStatus): Observable<Treatment> {
    return this.http.patch<ApiResponse<Treatment>>(`${this.API}/${id}/${status}`, {}, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getTreatmentsByDoctorId(doctorId: number): Observable<Treatment[]> {
    return this.http.get<ApiResponse<Treatment[]>>(`${this.API}/assigned-by/${doctorId}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }
}
