import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { Emergency, EmergencyRequest, EmergencyResponse, EmergencyStatus } from '../../models/emergency.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class EmergencyService {
  private readonly API = 'http://localhost:9090/emergencies';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  reportEmergency(request: EmergencyRequest): Observable<Emergency> {
    return this.http.post<ApiResponse<Emergency>>(`${this.API}/report`, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllEmergencies(): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[]>>(this.API, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getMyEmergencies(): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[]>>(`${this.API}/my`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getPendingEmergencies(): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[]>>(`${this.API}/pending`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAvailableAmbulances(): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/ambulances/available`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  dispatchAmbulance(emergencyId: number, dispatcherId: number, request: any): Observable<Emergency> {
    return this.http.post<ApiResponse<Emergency>>(`${this.API}/${emergencyId}/dispatch`, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getDispatchedEmergencies(): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[]>>(`${this.API}/dispatched`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getMyDispatchHistory(): Observable<Emergency[]> {
    return this.http.get<ApiResponse<Emergency[]>>(`${this.API}/my-dispatch-history`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getEmergencyById(id: number): Observable<Emergency> {
    return this.http.get<ApiResponse<Emergency>>(`${this.API}/${id}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }
}
