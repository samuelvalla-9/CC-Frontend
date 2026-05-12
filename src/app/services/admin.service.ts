import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { User } from '../../models/user.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface CreateStaffRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  facilityId: number;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly API = 'http://localhost:9090/admin';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  // User Management
  getAllUsers(): Observable<User[]> {
    return this.http.get<any>(`${this.API}/users`, { headers: this.headers })
      .pipe(
        map(res => {
          console.log('Raw API response:', res);
          // Handle ApiResponse wrapper
          let users = res.data || res;
          
          // If still wrapped, try to unwrap
          if (users && users.data) {
            users = users.data;
          }
          
          // Ensure it's an array
          if (!Array.isArray(users)) {
            console.error('Users is not an array:', users);
            return [];
          }
          
          // Map to ensure both id and userId exist
          return users.map((u: any) => ({
            ...u,
            id: u.userId || u.id,
            userId: u.userId || u.id
          }));
        })
      );
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<ApiResponse<User>>(`${this.API}/users/${id}`, { headers: this.headers })
      .pipe(map(res => ({ ...res.data, id: res.data.userId, userId: res.data.userId })));
  }

  activateUser(id: number): Observable<User> {
    console.log('AdminService.activateUser called with id:', id);
    return this.http.patch<ApiResponse<User>>(`${this.API}/users/${id}/activate`, {}, { headers: this.headers })
      .pipe(map(res => {
        console.log('AdminService.activateUser - Raw API response:', res);
        const user = res.data;
        const mappedUser = { 
          ...user, 
          id: user.userId, 
          userId: user.userId, 
          status: user.status || 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
        };
        console.log('AdminService.activateUser - Mapped user:', mappedUser);
        return mappedUser;
      }));
  }

  deactivateUser(id: number): Observable<User> {
    console.log('AdminService.deactivateUser called with id:', id);
    return this.http.patch<ApiResponse<User>>(`${this.API}/users/${id}/deactivate`, {}, { headers: this.headers })
      .pipe(map(res => {
        console.log('AdminService.deactivateUser - Raw API response:', res);
        const user = res.data;
        const mappedUser = { 
          ...user, 
          id: user.userId, 
          userId: user.userId, 
          status: user.status || 'INACTIVE' as 'ACTIVE' | 'INACTIVE'
        };
        console.log('AdminService.deactivateUser - Mapped user:', mappedUser);
        return mappedUser;
      }));
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.API}/users/${id}`, { headers: this.headers })
      .pipe(map(() => void 0));
  }

  deleteStaffRecord(id: number): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`http://localhost:9090/staff/${id}`, { headers: this.headers })
      .pipe(map(() => void 0));
  }

  // Staff Management (AuthService only - no facility record)
  createStaff(data: CreateStaffRequest): Observable<User> {
    return this.http.post<ApiResponse<User>>(`${this.API}/staff`, data, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  // Create staff via FacilityService - creates entries in BOTH users table (Auth) and staff table (Facility)
  createStaffViaFacility(data: CreateStaffRequest): Observable<any> {
    return this.http.post<ApiResponse<any>>('http://localhost:9090/staff', data, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllStaff(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(`${this.API}/staff`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  createDispatcher(data: CreateStaffRequest): Observable<User> {
    return this.http.post<ApiResponse<User>>(`${this.API}/dispatchers`, data, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getAllDispatchers(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(`${this.API}/dispatchers`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  createComplianceOfficer(data: CreateUserRequest): Observable<User> {
    return this.http.post<ApiResponse<User>>(`${this.API}/compliance-officers`, data, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  createHealthOfficer(data: CreateUserRequest): Observable<User> {
    return this.http.post<ApiResponse<User>>(`${this.API}/health-officers`, data, { headers: this.headers })
      .pipe(map(res => res.data));
  }
}
