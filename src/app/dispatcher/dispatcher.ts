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

@Component({
  selector: 'app-dispatcher',
  imports: [FormsModule, CommonModule, Navbar, DatePipe],
  templateUrl: './dispatcher.html',
  styleUrl: './dispatcher.css',
})
export class DispatcherDashboard implements OnInit {
  activeTab = 'overview';
  pendingEmergencies: Emergency[] = [];
  notifications: Notification[] = [];
  unreadCount = 0;
  availableAmbulances: any[] = [];

  dispatchForm = { emergencyId: '', ambulanceId: '' };
  errorMsg = '';

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient, 
    private auth: AuthService, 
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadPending();
    this.loadNotifications();
    this.loadAvailableAmbulances();
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
          console.error('Failed to load ambulances:', err);
        } 
      });
  }

  dispatch(e: Emergency) {
    this.dispatchForm.emergencyId = String(e.emergencyId);
    this.dispatchForm.ambulanceId = ''; // Reset ambulance selection
    this.loadAvailableAmbulances(); // Refresh available ambulances
    this.activeTab = 'dispatch';
  }

  submitDispatch() {
    if (!this.dispatchForm.ambulanceId) {
      this.errorMsg = 'Please select an ambulance';
      return;
    }
    
    this.errorMsg = '';
    const userId = this.auth.getUser()?.id;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.auth.getToken()}`,
      'X-Auth-UserId': String(userId)
    });
    
    this.http.post<any>(`http://localhost:9090/emergencies/${this.dispatchForm.emergencyId}/dispatch`,
      { ambulanceId: Number(this.dispatchForm.ambulanceId) }, { headers })
      .subscribe({
        next: () => { 
          this.dispatchForm = { emergencyId: '', ambulanceId: '' };
          this.activeTab = 'overview';
          this.loadPending();
          this.loadAvailableAmbulances();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.errorMsg = 'Failed to dispatch ambulance: ' + (err.error?.message || err.message);
        }
      });
  }


}
