import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { Facility, FacilityRequest, Ambulance, AmbulanceRequest, FacilityStatus } from '../../models/facility.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class FacilityService {
  private readonly API = 'http://localhost:9090/facilities';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  createFacility(request: FacilityRequest): Observable<Facility> {
    return this.http.post<ApiResponse<Facility>>(this.API, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllFacilities(): Observable<Facility[]> {
    return this.http.get<ApiResponse<Facility[]>>(this.API, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getFacilityById(id: number): Observable<Facility> {
    return this.http.get<ApiResponse<Facility>>(`${this.API}/${id}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  updateFacility(id: number, request: FacilityRequest): Observable<Facility> {
    return this.http.put<ApiResponse<Facility>>(`${this.API}/${id}`, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  updateFacilityStatus(id: number, status: FacilityStatus): Observable<Facility> {
    return this.http.patch<ApiResponse<Facility>>(`${this.API}/${id}/status?status=${status}`, {}, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getFacilityStaff(id: number): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/${id}/staff`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getFacilitiesByType(type: string): Observable<Facility[]> {
    return this.http.get<ApiResponse<Facility[]>>(`${this.API}/type/${type}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getFacilitiesByStatus(status: FacilityStatus): Observable<Facility[]> {
    return this.http.get<ApiResponse<Facility[]>>(`${this.API}/status/${status}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }
}

@Injectable({ providedIn: 'root' })
export class AmbulanceService {
  private readonly API = 'http://localhost:9090/emergencies/admin/ambulances';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  createAmbulance(request: AmbulanceRequest): Observable<Ambulance> {
    return this.http.post<ApiResponse<Ambulance>>(this.API, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllAmbulances(): Observable<Ambulance[]> {
    return this.http.get<ApiResponse<Ambulance[]>>(this.API, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAvailableAmbulances(): Observable<Ambulance[]> {
    return this.http.get<ApiResponse<Ambulance[]>>(`${this.API}/available`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  updateAmbulanceStatus(id: number, status: string): Observable<Ambulance> {
    return this.http.patch<ApiResponse<Ambulance>>(`${this.API}/${id}/status?status=${status}`, {}, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  deleteAmbulance(id: number): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.API}/${id}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }
}

