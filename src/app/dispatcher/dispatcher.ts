import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { Emergency } from '../../models/emergency.model';
import { Notification } from '../../models/notification.model';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { ToastComponent } from '../shared/toast';

@Component({
  selector: 'app-dispatcher',
  imports: [FormsModule, CommonModule, Navbar, DatePipe, ToastComponent],
  templateUrl: './dispatcher.html',
  styleUrl: './dispatcher.css',
})
export class DispatcherDashboard implements OnInit {
  activeTab = 'overview';
  pendingEmergencies: Emergency[] = [];
  dispatchedEmergencies: any[] = [];
  notifications: Notification[] = [];
  unreadCount = 0;
  availableAmbulances: any[] = [];
  dispatchingEmergencyId: number | null = null;
  isSubmitting = false;

  dispatchForm = { emergencyId: '', ambulanceId: '' };
  errorMsg = '';

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient, 
    private auth: AuthService, 
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.handleTabChange(this.activeTab);
      }
    });

    this.loadPending();
    this.loadDispatchHistory();
    this.loadNotifications();
    this.loadAvailableAmbulances();
  }

  setTab(tab: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  private handleTabChange(tab: string) {
    if (tab === 'overview') { this.loadPending(); this.loadAvailableAmbulances(); }
    if (tab === 'history') this.loadDispatchHistory();
    if (tab === 'notifications') this.loadNotifications();
  }

  loadPending() {
    this.http.get<any>('http://localhost:9090/emergencies/pending', { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.pendingEmergencies = d?.data ?? d;
          this.cdr.detectChanges();
        }, 
        error: () => {} 
      });
  }

  loadDispatchHistory() {
    this.http.get<any>('http://localhost:9090/emergencies/dispatched', { headers: this.headers })
      .subscribe({
        next: d => {
          this.dispatchedEmergencies = d?.data ?? d ?? [];
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  loadNotifications() {
    this.notificationService.getMyNotifications().subscribe({
      next: d => { 
        this.notifications = d; 
        this.unreadCount = d.filter(n => n.status === 'UNREAD').length;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  markRead(id: number) {
    this.notificationService.markAsRead(id).subscribe({
      next: () => this.loadNotifications(),
      error: () => {}
    });
  }

  markAllRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => this.loadNotifications(),
      error: () => {}
    });
  }

  loadAvailableAmbulances() {
    this.http.get<any>('http://localhost:9090/emergencies/admin/ambulances', { headers: this.headers })
      .subscribe({ 
        next: d => {
          const allAmbulances = d?.data ?? d;
          this.availableAmbulances = allAmbulances.filter((a: any) => a.status === 'AVAILABLE');
          this.cdr.detectChanges();
        }, 
        error: (err) => {
          this.toastService.showError('Failed to load ambulances');
        } 
      });
  }

  startDispatch(e: Emergency) {
    this.dispatchingEmergencyId = e.emergencyId;
    this.dispatchForm.emergencyId = String(e.emergencyId);
    this.dispatchForm.ambulanceId = '';
    this.loadAvailableAmbulances();
  }

  cancelDispatch() {
    this.dispatchingEmergencyId = null;
    this.dispatchForm = { emergencyId: '', ambulanceId: '' };
  }

  confirmDispatch(e: Emergency) {
    if (!this.dispatchForm.ambulanceId) {
      this.toastService.showError('Please select an ambulance');
      return;
    }
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    
    const userId = this.auth.getUser()?.id;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.auth.getToken()}`,
      'X-Auth-UserId': String(userId)
    });
    
    this.http.post<any>(`http://localhost:9090/emergencies/${e.emergencyId}/dispatch`,
      { ambulanceId: Number(this.dispatchForm.ambulanceId) }, { headers })
      .subscribe({
        next: () => { 
          this.isSubmitting = false;
          this.dispatchingEmergencyId = null;
          this.dispatchForm = { emergencyId: '', ambulanceId: '' };
          this.toastService.showSuccess('Ambulance dispatched successfully');
          this.loadPending();
          this.loadDispatchHistory();
          this.loadAvailableAmbulances();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.showError('Failed to dispatch ambulance');
        }
      });
  }


}
