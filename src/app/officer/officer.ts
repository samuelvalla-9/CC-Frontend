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

  // Overview analytics
  admissionsTrend7d: Array<{ dateKey: string; label: string; count: number }> = [];
  resourceAlerts: Array<{ title: string; subtitle: string; severity: 'info' | 'warning' | 'success'; targetTab: string }> = [];
  recentCityActivity: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];
  overviewKpis = {
    activeFacilities: 0,
    activeEmergencies: 0,
    observationPatients: 0,
    complianceAttention: 0,
  };

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
    if (this.activeTab === tab) return;
    this.activeTab = tab;
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
      .subscribe({
        next: d => {
          this.facilities = d?.data ?? d ?? [];
          this.refreshOverviewInsights();
        },
        error: () => {
          this.facilities = [];
          this.refreshOverviewInsights();
        }
      });
  }

  loadEmergencies() {
    this.http.get<any>('http://localhost:9090/emergencies/pending', { headers: this.headers })
      .subscribe({
        next: d => {
          this.emergencies = d?.data ?? d ?? [];
          this.refreshOverviewInsights();
        },
        error: () => {
          this.emergencies = [];
          this.refreshOverviewInsights();
        }
      });
  }

  loadPatients() {
    this.http.get<any>('http://localhost:9090/patients', { headers: this.headers })
      .subscribe({
        next: d => {
          this.patients = d?.data ?? d ?? [];
          this.refreshOverviewInsights();
        },
        error: () => {
          this.patients = [];
          this.refreshOverviewInsights();
        }
      });
  }

  loadCompliance() {
    this.http.get<any>('http://localhost:9090/compliance/records', { headers: this.headers })
      .subscribe({
        next: d => {
          this.complianceRecords = d?.data ?? d ?? [];
          this.refreshOverviewInsights();
        },
        error: () => {
          this.complianceRecords = [];
          this.refreshOverviewInsights();
        }
      });
  }

  loadNotifications() {
    this.notificationService.getMyNotifications().subscribe({
      next: d => {
        this.notifications = d;
        this.unreadCount = d.filter((n: any) => n.status === 'UNREAD').length;
        this.refreshOverviewInsights();
      },
      error: () => {}
    });
  }

  private refreshOverviewInsights() {
    this.buildOverviewKpis();
    this.buildAdmissionsTrend7d();
    this.buildResourceAlerts();
    this.buildRecentCityActivity();
  }

  private buildOverviewKpis() {
    const complianceAttentionResults = new Set(['FAILED', 'NEEDS_REVIEW', 'NON_COMPLIANT']);
    const complianceAttentionStatuses = new Set(['PENDING', 'IN_PROGRESS', 'INITIATED']);

    this.overviewKpis = {
      activeFacilities: this.facilities.filter(f => {
        const status = String(f?.status ?? '').toUpperCase();
        return status === 'ACTIVE' || status === 'OPERATIONAL';
      }).length,
      activeEmergencies: this.emergencies.length,
      observationPatients: this.patients.filter(p => String(p?.status ?? '').toUpperCase() === 'UNDER_OBSERVATION').length,
      complianceAttention: this.complianceRecords.filter(c => {
        const result = String(c?.result ?? '').toUpperCase();
        const status = String(c?.status ?? '').toUpperCase();
        return complianceAttentionResults.has(result) || complianceAttentionStatuses.has(status);
      }).length,
    };
  }

  private buildAdmissionsTrend7d() {
    const now = new Date();
    const buckets: Array<{ dateKey: string; label: string; count: number }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      buckets.push({
        dateKey: this.toDateKey(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        count: 0,
      });
    }

    const map = new Map(buckets.map(b => [b.dateKey, b]));
    this.patients.forEach(p => {
      const dt = this.tryParseDate((p as any)?.admissionDate);
      if (!dt) return;
      const bucket = map.get(this.toDateKey(dt));
      if (bucket) bucket.count += 1;
    });

    this.admissionsTrend7d = buckets;
  }

  private buildResourceAlerts() {
    const alerts: Array<{ title: string; subtitle: string; severity: 'info' | 'warning' | 'success'; targetTab: string }> = [];

    const inactiveFacilities = this.facilities.filter(f => {
      const status = String(f?.status ?? '').toUpperCase();
      return status === 'INACTIVE' || status === 'MAINTENANCE';
    }).length;
    if (inactiveFacilities > 0) {
      alerts.push({
        title: 'Facility capacity risk',
        subtitle: `${inactiveFacilities} facility(s) are inactive or under maintenance.`,
        severity: 'warning',
        targetTab: 'facilities',
      });
    }

    if (this.emergencies.length > 0) {
      alerts.push({
        title: 'Pending emergency backlog',
        subtitle: `${this.emergencies.length} emergency case(s) are awaiting action.`,
        severity: 'warning',
        targetTab: 'emergencies',
      });
    }

    const observationPatients = this.patients.filter(p => String(p?.status ?? '').toUpperCase() === 'UNDER_OBSERVATION').length;
    if (observationPatients > 0) {
      alerts.push({
        title: 'Under-observation patient load',
        subtitle: `${observationPatients} patient(s) currently under observation.`,
        severity: 'warning',
        targetTab: 'patients',
      });
    }

    if (this.overviewKpis.complianceAttention > 0) {
      alerts.push({
        title: 'Compliance actions pending',
        subtitle: `${this.overviewKpis.complianceAttention} record(s) need compliance follow-up.`,
        severity: 'info',
        targetTab: 'compliance',
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        title: 'City operations stable',
        subtitle: 'No immediate resource alerts detected.',
        severity: 'success',
        targetTab: 'overview',
      });
    }

    this.resourceAlerts = alerts.slice(0, 6);
  }

  private buildRecentCityActivity() {
    const events: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];

    this.emergencies.forEach(e => {
      const ts = this.tryParseDate((e as any)?.reportedAt ?? (e as any)?.date);
      if (!ts) return;
      events.push({
        message: `Emergency #${e?.emergencyId ?? '?'} pending at ${e?.location ?? 'Unknown location'}`,
        timestamp: ts,
        severity: 'warning',
      });
    });

    this.patients.forEach(p => {
      const ts = this.tryParseDate((p as any)?.admissionDate);
      if (!ts) return;
      events.push({
        message: `Patient #${p?.patientId ?? '?'} admitted (${p?.status ?? 'UNKNOWN'})`,
        timestamp: ts,
        severity: String(p?.status ?? '').toUpperCase() === 'UNDER_OBSERVATION' ? 'warning' : 'info',
      });
    });

    this.complianceRecords.forEach(c => {
      const ts = this.tryParseDate((c as any)?.recordedDate ?? (c as any)?.date ?? (c as any)?.createdDate);
      if (!ts) return;
      const result = String(c?.result ?? '').toUpperCase();
      events.push({
        message: `Compliance #${c?.complianceId ?? '?'}: ${c?.type ?? c?.entityType ?? 'ENTITY'} ${c?.entityId ?? ''} → ${c?.result ?? c?.status ?? 'UPDATED'}`,
        timestamp: ts,
        severity: result === 'FAILED' || result === 'NON_COMPLIANT' ? 'warning' : 'info',
      });
    });

    this.notifications.forEach(n => {
      const ts = this.tryParseDate((n as any)?.createdDate);
      if (!ts) return;
      events.push({
        message: n?.message ?? 'Notification event',
        timestamp: ts,
        severity: n?.status === 'UNREAD' ? 'warning' : 'info',
      });
    });

    this.recentCityActivity = events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 16);
  }

  getAdmissionsTrendBarHeight(count: number): number {
    const max = Math.max(...this.admissionsTrend7d.map(x => x.count), 1);
    return Math.max((count / max) * 100, count > 0 ? 12 : 4);
  }

  formatActivityTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  getActivitySeverityClass(severity: 'info' | 'warning' | 'success'): string {
    if (severity === 'warning') return 'warning';
    if (severity === 'success') return 'success';
    return 'info';
  }

  private tryParseDate(value: any): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
