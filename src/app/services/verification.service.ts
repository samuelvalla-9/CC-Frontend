import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';

export interface PendingCitizen {
  citizenId: number;
  name: string;
  contactInfo: string;
  address?: string;
  pendingCount: number;
}

@Injectable({ providedIn: 'root' })
export class VerificationService {
  private readonly API = 'http://localhost:9090/api/citizens';
  private pendingCountSubject = new BehaviorSubject<number>(0);
  private pendingCitizensSubject = new BehaviorSubject<PendingCitizen[]>([]);
  
  pendingCount$ = this.pendingCountSubject.asObservable();
  pendingCitizens$ = this.pendingCitizensSubject.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  loadPendingVerifications(): Observable<void> {
    return new Observable(observer => {
      this.http.get<any>(this.API, { headers: this.headers })
        .subscribe({
          next: res => {
            const citizens = res?.data ?? res;
            const pendingList: PendingCitizen[] = [];
            let totalPending = 0;
            let processed = 0;

            if (citizens.length === 0) {
              this.pendingCountSubject.next(0);
              this.pendingCitizensSubject.next([]);
              observer.next();
              observer.complete();
              return;
            }

            citizens.forEach((citizen: any) => {
              this.http.get<any>(`${this.API}/${citizen.citizenId}/documents`, { headers: this.headers })
                .subscribe({
                  next: docRes => {
                    const docs = docRes?.data ?? docRes;
                    const pending = docs.filter((d: any) => d.verificationStatus === 'PENDING');
                    
                    if (pending.length > 0) {
                      pendingList.push({
                        citizenId: citizen.citizenId,
                        name: citizen.name,
                        contactInfo: citizen.contactInfo,
                        address: citizen.address,
                        pendingCount: pending.length
                      });
                      totalPending += pending.length;
                    }

                    processed++;
                    if (processed === citizens.length) {
                      this.pendingCountSubject.next(totalPending);
                      this.pendingCitizensSubject.next(pendingList);
                      observer.next();
                      observer.complete();
                    }
                  },
                  error: () => {
                    processed++;
                    if (processed === citizens.length) {
                      this.pendingCountSubject.next(totalPending);
                      this.pendingCitizensSubject.next(pendingList);
                      observer.next();
                      observer.complete();
                    }
                  }
                });
            });
          },
          error: err => {
            observer.error(err);
          }
        });
    });
  }

  getPendingCount(): number {
    return this.pendingCountSubject.value;
  }

  getPendingCitizens(): PendingCitizen[] {
    return this.pendingCitizensSubject.value;
  }

  refreshVerifications(): void {
    this.loadPendingVerifications().subscribe();
  }
}
