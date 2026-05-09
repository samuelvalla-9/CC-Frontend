import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe, CommonModule } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-officer',
  imports: [FormsModule, CommonModule, Navbar, DatePipe],
  templateUrl: './officer.html',
  styleUrl: './officer.css',
})
export class OfficerDashboard implements OnInit {
  activeTab = 'overview';
  facilities: any[] = [];
  emergencies: any[] = [];
  patients: any[] = [];
  complianceRecords: any[] = [];
  notifications: any[] = [];
  unreadCount = 0;

  // Computed KPIs
  get emergencyResponseRate(): number {
    if (this.emergencies.length === 0) return 0;
    const dispatched = this.emergencies.filter(e => e.status === 'DISPATCHED' || e.status === 'CLOSED' || e.status === 'RESOLVED').length;
    return Math.round((dispatched / this.emergencies.length) * 100);
  }

  get patientRecoveryRate(): number {
    if (this.patients.length === 0) return 0;
    const recovered = this.patients.filter(p => p.status === 'DISCHARGED' || p.status === 'RECOVERED').length;
    return Math.round((recovered / this.patients.length) * 100);
  }

  get compliancePassRate(): number {
    if (this.complianceRecords.length === 0) return 0;
    const passed = this.complianceRecords.filter(c => c.result === 'PASS' || c.status === 'COMPLIANT').length;
    return Math.round((passed / this.complianceRecords.length) * 100);
  }

  get activeFacilities(): number {
    return this.facilities.filter(f => f.status === 'ACTIVE' || f.status === 'OPERATIONAL').length;
  }

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.handleTabChange(this.activeTab);
      }
    });

    this.loadFacilities();
    this.loadEmergencies();
    this.loadPatients();
    this.loadCompliance();
    this.loadNotifications();
  }

  setTab(tab: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  private handleTabChange(tab: string) {
    if (tab === 'facilities') this.loadFacilities();
    if (tab === 'emergencies') this.loadEmergencies();
    if (tab === 'patients') this.loadPatients();
    if (tab === 'compliance') this.loadCompliance();
    if (tab === 'notifications') this.loadNotifications();
  }

  loadFacilities() {
    this.http.get<any>('http://localhost:9090/facilities', { headers: this.headers })
      .subscribe({ next: d => this.facilities = d?.data ?? d ?? [], error: () => {} });
  }

  loadEmergencies() {
    this.http.get<any>('http://localhost:9090/emergencies/pending', { headers: this.headers })
      .subscribe({ next: d => this.emergencies = d?.data ?? d ?? [], error: () => {} });
  }

  loadPatients() {
    this.http.get<any>('http://localhost:9090/patients', { headers: this.headers })
      .subscribe({ next: d => this.patients = d?.data ?? d ?? [], error: () => {} });
  }

  loadCompliance() {
    this.http.get<any>('http://localhost:9090/compliance/records', { headers: this.headers })
      .subscribe({ next: d => this.complianceRecords = d?.data ?? d ?? [], error: () => {} });
  }

  loadNotifications() {
    this.notificationService.getMyNotifications().subscribe({
      next: d => {
        this.notifications = d;
        this.unreadCount = d.filter((n: any) => n.status === 'UNREAD').length;
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
}
