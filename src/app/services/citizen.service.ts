import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, map, tap } from 'rxjs';
import { AuthService } from './auth.service';

export interface CitizenProfile {
  citizenId: number;
  userId: number;
  name: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  contactInfo: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
  isVerified?: boolean;
}

export interface CitizenDocument {
  documentId: number;
  uploadedDate: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class CitizenService {
  private readonly API = 'http://localhost:9090/api/citizens';
  private profileSubject = new BehaviorSubject<CitizenProfile | null>(null);
  private documentsSubject = new BehaviorSubject<CitizenDocument[]>([]);
  profile$ = this.profileSubject.asObservable();
  documents$ = this.documentsSubject.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ 
      Authorization: `Bearer ${this.auth.getToken()}`
    });
  }

  getMyProfile(): Observable<CitizenProfile> {
    return this.http.get<ApiResponse<CitizenProfile>>(`${this.API}/profile`, { headers: this.headers })
      .pipe(
        map(res => res.data),
        tap(profile => this.profileSubject.next(profile))
      );
  }

  updateProfile(data: Partial<CitizenProfile>): Observable<CitizenProfile> {
    return this.http.put<ApiResponse<CitizenProfile>>(`${this.API}/profile`, data, { headers: this.headers })
      .pipe(
        map(res => res.data),
        tap(profile => this.profileSubject.next(profile))
      );
  }

  getCurrentProfile(): CitizenProfile | null {
    return this.profileSubject.value;
  }

  isProfileComplete(): boolean {
    const p = this.profileSubject.value;
    return !!(p?.name && p?.contactInfo && p?.address && p?.dateOfBirth && p?.gender);
  }

  isVerified(): boolean {
    const docs = this.documentsSubject.value;
    return docs.some(d => d.verificationStatus === 'VERIFIED');
  }

  getAllCitizens(): Observable<CitizenProfile[]> {
    return this.http.get<ApiResponse<CitizenProfile[]>>(this.API, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getCitizenById(id: number): Observable<CitizenProfile> {
    return this.http.get<ApiResponse<CitizenProfile>>(`${this.API}/${id}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  uploadDocument(citizenId: number, file: File): Observable<CitizenDocument> {
    const formData = new FormData();
    formData.append('file', file);
    const uploadHeaders = new HttpHeaders({ 
      Authorization: `Bearer ${this.auth.getToken()}`
    });
    return this.http.post<ApiResponse<CitizenDocument>>(`${this.API}/${citizenId}/documents`, formData, { headers: uploadHeaders })
      .pipe(
        map(res => res.data),
        tap(() => this.getMyDocuments(citizenId).subscribe())
      );
  }

  getMyDocuments(citizenId: number): Observable<CitizenDocument[]> {
    return this.http.get<ApiResponse<CitizenDocument[]>>(`${this.API}/${citizenId}/documents`, { headers: this.headers })
      .pipe(
        map(res => res.data),
        tap(docs => this.documentsSubject.next(docs))
      );
  }

  verifyDocument(docId: number, status: 'VERIFIED' | 'REJECTED'): Observable<CitizenDocument> {
    return this.http.patch<ApiResponse<CitizenDocument>>(`${this.API}/documents/${docId}/verify?status=${status}`, {}, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getDocumentBlob(citizenId: number, docId: number): Observable<Blob> {
    return this.http.get(`${this.API}/${citizenId}/documents/${docId}/download`, { 
      headers: this.headers, 
      responseType: 'blob' 
    });
  }
}
