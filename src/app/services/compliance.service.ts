import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { ComplianceRecord, Audit, AuditLog, ComplianceRecordRequest, AuditRequest } from '../../models/compliance.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class ComplianceService {
  private readonly API = 'http://localhost:9090/compliance';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ 
      Authorization: `Bearer ${this.auth.getToken()}`
    });
  }

  createRecord(request: ComplianceRecordRequest): Observable<ComplianceRecord> {
    return this.http.post<ApiResponse<ComplianceRecord>>(`${this.API}/records`, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllRecords(): Observable<ComplianceRecord[]> {
    return this.http.get<ApiResponse<ComplianceRecord[]>>(`${this.API}/records`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getRecordById(id: number): Observable<ComplianceRecord> {
    return this.http.get<ApiResponse<ComplianceRecord>>(`${this.API}/records/${id}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getRecordsByEntity(entityId: number): Observable<ComplianceRecord[]> {
    return this.http.get<ApiResponse<ComplianceRecord[]>>(`${this.API}/records/entity/${entityId}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  initiateAudit(request: AuditRequest): Observable<Audit> {
    return this.http.post<ApiResponse<Audit>>(`${this.API}/audits`, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllAudits(): Observable<Audit[]> {
    return this.http.get<ApiResponse<Audit[]>>(`${this.API}/audits`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAuditById(id: number): Observable<Audit> {
    return this.http.get<ApiResponse<Audit>>(`${this.API}/audits/${id}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllAuditLogs(): Observable<AuditLog[]> {
    return this.http.get<ApiResponse<AuditLog[]>>(`${this.API}/logs`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAuditLogById(id: number): Observable<AuditLog> {
    return this.http.get<ApiResponse<AuditLog>>(`${this.API}/logs/${id}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }
}
