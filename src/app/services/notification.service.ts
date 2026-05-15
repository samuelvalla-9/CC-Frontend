import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map, tap, of, timer, Subscription, switchMap, catchError } from 'rxjs';
import { AuthService } from './auth.service';
import {
  Notification,
  NotificationCategory,
  NotificationRequest,
  NotificationStatus,
  EmergencyEventRequest,
  PatientEventRequest,
  ComplianceEventRequest,
  AuthEventRequest,
  FacilityEventRequest,
  DocumentEventRequest,
} from '../../models/notification.model';
import { ApiResponse } from '../../models/api-response.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly API = `${environment.apiBaseUrl}/notifications`;
  private readonly POLLING_INTERVAL_MS = 3000;
  private readonly notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private pollingSubscription: Subscription | null = null;
  private pollingInitializedForUser: number | null = null;

  constructor(private http: HttpClient, private auth: AuthService) {}

  createNotification(request: NotificationRequest): Observable<Notification> {
    return this.http.post<ApiResponse<Notification>>(this.API, request)
      .pipe(map(res => res.data));
  }

  getMyNotifications(): Observable<Notification[]> {
    const userId = this.auth.getUser()?.id;
    if (!userId) {
      this.stopPolling();
      this.notificationsSubject.next([]);
      return of([]);
    }

    this.ensurePolling(userId);
    return this.notificationsSubject.asObservable();
  }

  getNotificationsForUser(userId: number): Observable<Notification[]> {
    return this.http.get<ApiResponse<Notification[]>>(`${this.API}/user/${userId}`)
      .pipe(map(res => res.data ?? []));
  }

  getUnreadNotifications(): Observable<Notification[]> {
    const userId = this.auth.getUser()?.id;
    if (!userId) {
      return of([]);
    }

    return this.getUnreadNotificationsForUser(userId);
  }

  getUnreadNotificationsForUser(userId: number): Observable<Notification[]> {
    return this.http.get<ApiResponse<Notification[]>>(`${this.API}/user/${userId}/unread`)
      .pipe(map(res => res.data ?? []));
  }

  getUnreadCount(): Observable<number> {
    const userId = this.auth.getUser()?.id;
    if (!userId) {
      return of(0);
    }

    return this.getUnreadCountForUser(userId);
  }

  getUnreadCountForUser(userId: number): Observable<number> {
    return this.http.get<ApiResponse<number>>(`${this.API}/user/${userId}/unread/count`)
      .pipe(map(res => res.data ?? 0));
  }

  getNotificationsByCategory(category: NotificationCategory): Observable<Notification[]> {
    return this.http.get<ApiResponse<Notification[]>>(`${this.API}/category/${category}`)
      .pipe(map(res => res.data ?? []));
  }

  markAsRead(notificationId: number): Observable<Notification> {
    return this.http.put<ApiResponse<Notification>>(`${this.API}/${notificationId}/read`, {})
      .pipe(
        map(res => res.data),
        tap(updated => {
          const current = this.notificationsSubject.value;
          this.notificationsSubject.next(
            current.map(n => n.notificationId === updated.notificationId ? updated : n)
          );
          this.refreshCurrentUserNotifications();
        })
      );
  }

  markAllAsRead(): Observable<number> {
    const userId = this.auth.getUser()?.id;
    if (!userId) {
      return of(0);
    }

    return this.markAllAsReadForUser(userId);
  }

  markAllAsReadForUser(userId: number): Observable<number> {
    return this.http.put<ApiResponse<number>>(`${this.API}/user/${userId}/read-all`, {})
      .pipe(
        map(res => res.data ?? 0),
        tap(() => {
          this.notificationsSubject.next(
            this.notificationsSubject.value.map(n => ({ ...n, status: NotificationStatus.READ }))
          );
          this.refreshCurrentUserNotifications();
        })
      );
  }

  deleteNotification(notificationId: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/${notificationId}`)
      .pipe(
        map(() => undefined),
        tap(() => {
          this.notificationsSubject.next(
            this.notificationsSubject.value.filter(n => n.notificationId !== notificationId)
          );
          this.refreshCurrentUserNotifications();
        })
      );
  }

  sendEmergencyEvent(request: EmergencyEventRequest): Observable<Notification> {
    return this.http.post<ApiResponse<Notification>>(`${this.API}/events/emergency`, request)
      .pipe(map(res => res.data));
  }

  sendPatientEvent(request: PatientEventRequest): Observable<Notification> {
    return this.http.post<ApiResponse<Notification>>(`${this.API}/events/patient`, request)
      .pipe(map(res => res.data));
  }

  sendComplianceEvent(request: ComplianceEventRequest): Observable<Notification> {
    return this.http.post<ApiResponse<Notification>>(`${this.API}/events/compliance`, request)
      .pipe(map(res => res.data));
  }

  sendAuthEvent(request: AuthEventRequest): Observable<Notification> {
    return this.http.post<ApiResponse<Notification>>(`${this.API}/events/auth`, request)
      .pipe(map(res => res.data));
  }

  sendFacilityEvent(request: FacilityEventRequest): Observable<Notification> {
    return this.http.post<ApiResponse<Notification>>(`${this.API}/events/facility`, request)
      .pipe(map(res => res.data));
  }

  sendDocumentEvent(request: DocumentEventRequest): Observable<Notification> {
    return this.http.post<ApiResponse<Notification>>(`${this.API}/events/document`, request)
      .pipe(map(res => res.data));
  }

  private ensurePolling(userId: number) {
    if (this.pollingInitializedForUser === userId && this.pollingSubscription && !this.pollingSubscription.closed) {
      return;
    }

    this.stopPolling();

    this.pollingSubscription = timer(0, this.POLLING_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.getNotificationsForUser(userId).pipe(
            catchError(() => of([]))
          )
        )
      )
      .subscribe(items => this.notificationsSubject.next(items));

    this.pollingInitializedForUser = userId;
  }

  private refreshCurrentUserNotifications() {
    const userId = this.auth.getUser()?.id;
    if (!userId) {
      return;
    }

    this.getNotificationsForUser(userId)
      .pipe(catchError(() => of([])))
      .subscribe(items => this.notificationsSubject.next(items));
  }

  private stopPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
    this.pollingInitializedForUser = null;
  }
}
