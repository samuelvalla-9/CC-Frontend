import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-compliance',
  imports: [FormsModule, Navbar, DatePipe],
  templateUrl: './compliance.html',
  styleUrl: './compliance.css',
})
export class ComplianceDashboard implements OnInit {
  activeTab = 'overview';
  complianceRecords: any[] = [];
  audits: any[] = [];
  auditLogs: any[] = [];
  notifications: any[] = [];
  unreadCount = 0;

  recordForm = { entityId: '', type: 'FACILITY', result: '', notes: '' };
  auditForm = { scope: '', findings: '' };
  entityTypes = ['FACILITY', 'PATIENT', 'EMERGENCY'];

  errorMsg = '';

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient, 
    private auth: AuthService,
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

    this.loadRecords();
    this.loadAudits();
    this.loadLogs();
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
    if (tab === 'records') this.loadRecords();
    if (tab === 'audits') this.loadAudits();
    if (tab === 'logs') this.loadLogs();
    if (tab === 'notifications') this.loadNotifications();
  }

  loadRecords() {
    this.http.get<any>('http://localhost:9090/compliance/records', { headers: this.headers })
      .subscribe({ next: d => this.complianceRecords = d?.data ?? d, error: () => {} });
  }

  loadAudits() {
    this.http.get<any>('http://localhost:9090/compliance/audits', { headers: this.headers })
      .subscribe({ next: d => this.audits = d?.data ?? d, error: () => {} });
  }

  loadLogs() {
    this.http.get<any>('http://localhost:9090/compliance/logs', { headers: this.headers })
      .subscribe({ next: d => this.auditLogs = d?.data ?? d, error: () => {} });
  }

  loadNotifications() {
    const userId = this.auth.getUser()?.id;
    this.http.get<any>(`http://localhost:9090/notifications/user/${userId}`, { headers: this.headers })
      .subscribe({ next: d => { const list = d?.data ?? d; this.notifications = list; this.unreadCount = list.filter((n: any) => n.status === 'UNREAD').length; }, error: () => {} });
  }

  createRecord() {
    this.errorMsg = '';
    this.http.post<any>('http://localhost:9090/compliance/records', this.recordForm, { headers: this.headers })
      .subscribe({
        next: () => { this.recordForm = { entityId: '', type: 'FACILITY', result: '', notes: '' }; this.loadRecords(); },
        error: () => this.errorMsg = 'Failed to create record'
      });
  }

  initiateAudit() {
    this.errorMsg = '';
    this.http.post<any>('http://localhost:9090/compliance/audits', this.auditForm, { headers: this.headers })
      .subscribe({
        next: () => { this.auditForm = { scope: '', findings: '' }; this.loadAudits(); },
        error: () => this.errorMsg = 'Failed to initiate audit'
      });
  }
}
