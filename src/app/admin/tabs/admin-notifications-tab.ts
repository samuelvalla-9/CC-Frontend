import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Notification } from '../../../models/notification.model';
import { NotificationService } from '../../services/notification.service';
import { finalize, Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-notifications-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-notifications-tab.html',
  styleUrl: '../admin.css'
})
export class AdminNotificationsTab implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  unreadCount = 0;
  private readonly actionInFlight = new Set<string>();
  private subscriptions: Subscription[] = [];

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.notificationService.getMyUnreadCount().subscribe({
        next: count => {
          this.unreadCount = count;
        }
      })
    );

    this.subscriptions.push(
      this.notificationService.getMyNotifications().subscribe({
        next: notifications => {
          this.notifications = notifications;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];
  }

  markRead(id: number) {
    const actionKey = `notification-read:${id}`;
    if (!this.beginAction(actionKey)) return;

    this.notificationService.markAsRead(id)
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {},
        error: () => {}
      });
  }

  markAllRead() {
    const actionKey = 'notifications-read-all';
    if (!this.beginAction(actionKey)) return;

    this.notificationService.markAllAsRead()
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {},
        error: () => {}
      });
  }

  isActionInFlight(actionKey: string): boolean {
    return this.actionInFlight.has(actionKey);
  }

  private beginAction(actionKey: string): boolean {
    if (this.actionInFlight.has(actionKey)) {
      return false;
    }
    this.actionInFlight.add(actionKey);
    return true;
  }

  private endAction(actionKey: string): void {
    this.actionInFlight.delete(actionKey);
  }
}
