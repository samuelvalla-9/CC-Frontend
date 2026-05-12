import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, map, tap, of } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import { AuthService } from './auth.service';
import { Notification, NotificationCategory, NotificationRequest, NotificationStatus } from '../../models/notification.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly API = 'http://localhost:9090/notifications';
  private readonly WS_URL = 'ws://localhost:8089/ws-notifications';
  private readonly notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private stompClient: Client | null = null;
  private realtimeInitializedForUser: number | null = null;

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
    if (!userId) {
      return of([]);
    }

    this.ensureRealtimeConnected(userId);
    this.refreshMyNotifications().subscribe();
    return this.notificationsSubject.asObservable();
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
      .pipe(
        map(res => res.data),
        tap(updated => {
          const current = this.notificationsSubject.value;
          this.notificationsSubject.next(
            current.map(n => n.notificationId === updated.notificationId ? updated : n)
          );
        })
      );
  }

  markAllAsRead(): Observable<number> {
    const userId = this.auth.getUser()?.id;
    return this.http.put<ApiResponse<number>>(`${this.API}/user/${userId}/read-all`, {}, { headers: this.headers })
      .pipe(
        map(res => res.data),
        tap(() => {
          this.notificationsSubject.next(
            this.notificationsSubject.value.map(n => ({ ...n, status: NotificationStatus.READ }))
          );
        })
      );
  }

  deleteNotification(notificationId: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/${notificationId}`, { headers: this.headers })
      .pipe(
        map(() => undefined),
        tap(() => {
          this.notificationsSubject.next(
            this.notificationsSubject.value.filter(n => n.notificationId !== notificationId)
          );
        })
      );
  }

  private refreshMyNotifications(): Observable<Notification[]> {
    const userId = this.auth.getUser()?.id;
    if (!userId) {
      this.notificationsSubject.next([]);
      return of([]);
    }

    return this.http
      .get<ApiResponse<Notification[]>>(`${this.API}/user/${userId}`, { headers: this.headers })
      .pipe(
        map(res => res.data ?? []),
        tap(items => this.notificationsSubject.next(items))
      );
  }

  private ensureRealtimeConnected(userId: number) {
    if (this.realtimeInitializedForUser === userId && this.stompClient?.active) {
      return;
    }

    this.disconnectRealtime();

    const token = this.auth.getToken();
    if (!token) {
      return;
    }

    this.stompClient = new Client({
      brokerURL: this.WS_URL,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      // Keep reconnect off to avoid repeated noisy retries when websocket auth/backend is unavailable.
      // Notifications still load from REST via refreshMyNotifications().
      reconnectDelay: 0,
      connectionTimeout: 8000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.stompClient?.subscribe('/user/queue/notifications', (message: IMessage) => {
          this.handleRealtimeMessage(message);
        });
      },
      onStompError: () => {
        // fail silently; reconnect handles temporary outages
      },
      onWebSocketError: () => {
        // fail silently; reconnect handles temporary outages
      },
    });

    this.stompClient.activate();
    this.realtimeInitializedForUser = userId;
  }

  private handleRealtimeMessage(message: IMessage) {
    try {
      const incoming = JSON.parse(message.body) as Notification;
      const current = this.notificationsSubject.value;
      const existingIndex = current.findIndex(n => n.notificationId === incoming.notificationId);

      if (existingIndex >= 0) {
        const updated = [...current];
        updated[existingIndex] = incoming;
        this.notificationsSubject.next(updated);
      } else {
        this.notificationsSubject.next([incoming, ...current]);
      }
    } catch {
      // ignore malformed websocket payloads
    }
  }

  private disconnectRealtime() {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
    this.realtimeInitializedForUser = null;
  }
}
