import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';

interface Report { reportId: number; scope: string; metrics: string; generatedDate: string; }
interface ComplianceRecord { complianceId: number; entityId: number; type: string; result: string; date: string; status: string; }

@Component({
  selector: 'app-officer',
  imports: [FormsModule, Navbar, DatePipe],
  templateUrl: './officer.html',
  styleUrl: './officer.css',
})
export class OfficerDashboard implements OnInit {
  activeTab = 'overview';
  facilityReports: any[] = [];
  emergencyReports: any[] = [];
  patientReports: any[] = [];
  complianceRecords: ComplianceRecord[] = [];
  notifications: any[] = [];
  unreadCount = 0;

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.loadReports();
    this.loadCompliance();
    this.loadNotifications();
  }

  loadReports() {
    this.http.get<any>('http://localhost:9090/facilities', { headers: this.headers })
      .subscribe({ next: d => this.facilityReports = Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [d?.data ?? d], error: () => {} });
    this.http.get<any>('http://localhost:9090/emergencies/pending', { headers: this.headers })
      .subscribe({ next: d => this.emergencyReports = Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [d?.data ?? d], error: () => {} });
    this.http.get<any>('http://localhost:9090/patients', { headers: this.headers })
      .subscribe({ next: d => this.patientReports = Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [d?.data ?? d], error: () => {} });
  }

  loadCompliance() {
    this.http.get<any>('http://localhost:9090/compliance/records', { headers: this.headers })
      .subscribe({ next: d => this.complianceRecords = d?.data ?? d, error: () => {} });
  }

  loadNotifications() {
    const userId = this.auth.getUser()?.id;
    this.http.get<any>(`http://localhost:9090/notifications/user/${userId}`, { headers: this.headers })
      .subscribe({ next: d => { const list = d?.data ?? d; this.notifications = list; this.unreadCount = list.filter((n: any) => n.status === 'UNREAD').length; }, error: () => {} });
  }
}
