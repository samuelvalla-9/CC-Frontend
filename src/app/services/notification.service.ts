import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { Notification, NotificationCategory, NotificationRequest } from '../../models/notification.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly API = 'http://localhost:9090/notifications';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  createNotification(request: NotificationRequest): Observable<Notification> {
    return this.http.post<ApiResponse<Notification>>(this.API, request, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getMyNotifications(): Observable<Notification[]> {
    const userId = this.auth.getUser()?.id;
    return this.http.get<ApiResponse<Notification[]>>(`${this.API}/user/${userId}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getUnreadNotifications(): Observable<Notification[]> {
    const userId = this.auth.getUser()?.id;
    return this.http.get<ApiResponse<Notification[]>>(`${this.API}/user/${userId}/unread`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getUnreadCount(): Observable<number> {
    const userId = this.auth.getUser()?.id;
    return this.http.get<ApiResponse<number>>(`${this.API}/user/${userId}/unread/count`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  getNotificationsByCategory(category: NotificationCategory): Observable<Notification[]> {
    return this.http.get<ApiResponse<Notification[]>>(`${this.API}/category/${category}`, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  markAsRead(notificationId: number): Observable<Notification> {
    return this.http.put<ApiResponse<Notification>>(`${this.API}/${notificationId}/read`, {}, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  markAllAsRead(): Observable<number> {
    const userId = this.auth.getUser()?.id;
    return this.http.put<ApiResponse<number>>(`${this.API}/user/${userId}/read-all`, {}, { headers: this.headers })
      .pipe(map(res => res.data));
  }

  deleteNotification(notificationId: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/${notificationId}`, { headers: this.headers })
      .pipe(map(() => undefined));
  }
}
