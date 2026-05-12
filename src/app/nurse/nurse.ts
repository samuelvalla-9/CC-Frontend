import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { NotificationService } from '../services/notification.service';
import { Patient, Treatment, PatientStatus, TreatmentStatus } from '../../models/patient.model';
import { Notification } from '../../models/notification.model';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-nurse',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, Navbar, DatePipe],
  templateUrl: './nurse.html',
  styleUrl: './nurse.css',
})
export class NurseDashboard implements OnInit {
  activeTab = 'overview';
  patients: Patient[] = [];
  myTreatments: Treatment[] = [];
  notifications: Notification[] = [];
  unreadCount = 0;
  selectedPatient: Patient | null = null;
  citizenDetails: any = null;
  emergencyDetails: any = null;
  patientTreatments: Treatment[] = [];
  showTreatmentForm: number | null = null;
  patientDoctorMap: Map<number, string> = new Map();
  statusHighlight = false;

  // Overview analytics
  treatmentTrend7d: Array<{ dateKey: string; label: string; count: number }> = [];
  pendingTaskQueue: Treatment[] = [];
  recentNursingActivity: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];
  overviewKpis = {
    activePatients: 0,
    observationPatients: 0,
    ongoingTreatments: 0,
    completed7d: 0,
  };

  get admittedCount() { return this.patients.filter(p => p.status === PatientStatus.ADMITTED).length; }
  get underObservationCount() { return this.patients.filter(p => p.status === PatientStatus.UNDER_OBSERVATION).length; }

  treatmentForm!: FormGroup;
  errorMsg = '';
  isSubmittingTreatment = false;
  private updatingTreatmentIds = new Set<number>();

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient, 
    public auth: AuthService,
    private toastService: ToastService, 
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.initTreatmentForm(0);
  }

  private initTreatmentForm(patientId: number) {
    this.treatmentForm = this.fb.group({
      patientId: [patientId],
      description: ['', Validators.required],
      medicationName: ['', Validators.required],
      dosage: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.handleTabChange(this.activeTab);
      }
    });

    this.loadPatients();
    this.loadMyTreatments();
    this.loadNotifications();
  }

  setTab(tab: string) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  private handleTabChange(tab: string) {
    if (tab === 'patients') this.loadPatients();
    if (tab === 'myTreatments') this.loadMyTreatments();
    if (tab === 'notifications') this.loadNotifications();
  }

  private staffFacilityId: number | null = null;

  loadPatients() {
    const nurseId = this.auth.getUser()?.id;
    if (!nurseId) return;

    const loadFromSource = (url: string) => {
      this.http.get<any>(url, { headers: this.headers })
        .subscribe({ 
          next: d => {
            this.patients = d?.data ?? d;
            this.patients.forEach(p => this.loadAssignedDoctor(p.patientId));
            this.refreshOverviewInsights();
            this.cdr.detectChanges();
          }, 
          error: () => {
            this.patients = [];
            this.refreshOverviewInsights();
          } 
        });
    };

    if (this.staffFacilityId) {
      loadFromSource(`http://localhost:9090/patients/facility/${this.staffFacilityId}`);
    } else {
      this.http.get<any>(`http://localhost:9090/staff/${nurseId}`, { headers: this.headers }).subscribe({
        next: (res) => {
          const staff = res?.data ?? res;
          this.staffFacilityId = staff.facilityId;
          if (this.staffFacilityId) {
            loadFromSource(`http://localhost:9090/patients/facility/${this.staffFacilityId}`);
          } else {
            loadFromSource('http://localhost:9090/patients');
          }
        },
        error: () => {
          loadFromSource('http://localhost:9090/patients');
        }
      });
    }
  }

  loadMyTreatments() {
    const nurseId = this.auth.getUser()?.id;
    this.http.get<any>(`http://localhost:9090/treatments/assigned-by/${nurseId}`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.myTreatments = d?.data ?? d;
          this.refreshOverviewInsights();
          this.cdr.detectChanges();
        }, 
        error: () => {
          this.myTreatments = [];
          this.refreshOverviewInsights();
        } 
      });
  }

  loadNotifications() {
    this.notificationService.getMyNotifications().subscribe({
      next: d => { 
        this.notifications = d; 
        this.unreadCount = d.filter(n => n.status === 'UNREAD').length;
        this.refreshOverviewInsights();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private refreshOverviewInsights() {
    this.buildOverviewKpis();
    this.buildTreatmentTrend7d();
    this.buildPendingTaskQueue();
    this.buildRecentNursingActivity();
  }

  private buildOverviewKpis() {
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - 6);

    this.overviewKpis = {
      activePatients: this.patients.filter(p => p.status !== PatientStatus.DISCHARGED).length,
      observationPatients: this.patients.filter(p => p.status === PatientStatus.UNDER_OBSERVATION).length,
      ongoingTreatments: this.myTreatments.filter(t => t.status === TreatmentStatus.ONGOING || t.status === TreatmentStatus.PENDING).length,
      completed7d: this.myTreatments.filter(t => {
        if (t.status !== TreatmentStatus.COMPLETED) return false;
        const dt = this.tryParseDate((t as any).endDate ?? (t as any).date ?? (t as any).startDate);
        return !!dt && dt >= rangeStart;
      }).length,
    };
  }

  private buildTreatmentTrend7d() {
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
    this.myTreatments.forEach(t => {
      const dt = this.tryParseDate((t as any).date ?? (t as any).startDate ?? (t as any).endDate);
      if (!dt) return;
      const bucket = map.get(this.toDateKey(dt));
      if (bucket) bucket.count += 1;
    });

    this.treatmentTrend7d = buckets;
  }

  private buildPendingTaskQueue() {
    this.pendingTaskQueue = [...this.myTreatments]
      .filter(t => t.status === TreatmentStatus.PENDING || t.status === TreatmentStatus.ONGOING)
      .sort((a, b) => {
        const aTime = this.tryParseDate((a as any).date ?? (a as any).startDate)?.getTime() ?? 0;
        const bTime = this.tryParseDate((b as any).date ?? (b as any).startDate)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 8);
  }

  private buildRecentNursingActivity() {
    const events: Array<{ message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];

    this.myTreatments.forEach(t => {
      const ts = this.tryParseDate((t as any).date ?? (t as any).startDate ?? (t as any).endDate);
      if (!ts) return;
      const status = String((t as any).status ?? '').toUpperCase();
      events.push({
        message: `Treatment #${t.treatmentId} for patient #${t.patientId} is ${status || 'UPDATED'}`,
        timestamp: ts,
        severity: status === 'COMPLETED' ? 'success' : (status === 'CANCELLED' ? 'warning' : 'info'),
      });
    });

    this.patients.forEach(p => {
      const admitted = this.tryParseDate((p as any).admissionDate);
      if (admitted) {
        events.push({
          message: `Patient #${p.patientId} in ward ${p.ward || 'N/A'} currently ${p.status}`,
          timestamp: admitted,
          severity: p.status === PatientStatus.UNDER_OBSERVATION ? 'warning' : 'info',
        });
      }
    });

    this.notifications.forEach(n => {
      const ts = this.tryParseDate((n as any).createdDate);
      if (!ts) return;
      events.push({
        message: n.message,
        timestamp: ts,
        severity: n.status === 'UNREAD' ? 'warning' : 'info',
      });
    });

    this.recentNursingActivity = events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 14);
  }

  getTreatmentTrendBarHeight(count: number): number {
    const max = Math.max(...this.treatmentTrend7d.map(x => x.count), 1);
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

  togglePatientDetails(patient: Patient) {
    this.selectedPatient = patient;
    this.showTreatmentForm = null;
    this.citizenDetails = null;
    this.emergencyDetails = null;
    this.setTab('patientDetail');

    // Load details after tab activation so bindings refresh as data streams in.
    this.loadPatientTreatments(patient.patientId);
    this.loadCitizenDetails(patient.citizenId);
    this.loadEmergencyDetails(patient.emergencyId);
  }

  loadPatientTreatments(patientId: number) {
    this.http.get<any>(`http://localhost:9090/patients/${patientId}/treatments`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.zone.run(() => {
            this.patientTreatments = d?.data ?? d;
            this.cdr.detectChanges();
          });
        }, 
        error: () => {} 
      });
  }

  loadCitizenDetails(citizenId: number) {
    this.http.get<any>(`http://localhost:9090/api/citizens/${citizenId}`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.zone.run(() => {
            this.citizenDetails = d?.data ?? d;
            this.cdr.detectChanges();
          });
        }, 
        error: () => {} 
      });
  }

  loadEmergencyDetails(emergencyId: number) {
    this.http.get<any>(`http://localhost:9090/emergencies/${emergencyId}`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.zone.run(() => {
            this.emergencyDetails = d?.data ?? d;
            this.cdr.detectChanges();
          });
        }, 
        error: () => {} 
      });
  }

  openTreatmentForm(patient: Patient) {
    this.showTreatmentForm = patient.patientId;
    this.initTreatmentForm(patient.patientId);
  }

  backToPatients() {
    this.setTab('patients');
    this.selectedPatient = null;
    this.citizenDetails = null;
    this.emergencyDetails = null;
    this.showTreatmentForm = null;
    this.patientTreatments = [];
  }

  cancelTreatmentForm() {
    this.showTreatmentForm = null;
    this.initTreatmentForm(0);
  }

  addTreatment() {
    if (this.isSubmittingTreatment) return;
    if (this.treatmentForm.invalid) {
      this.treatmentForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields');
      return;
    }
    this.isSubmittingTreatment = true;
    this.http.post<any>('http://localhost:9090/treatments', this.treatmentForm.value, { headers: this.headers })
      .pipe(
        finalize(() => {
          this.isSubmittingTreatment = false;
        })
      )
      .subscribe({
        next: () => { 
          this.showTreatmentForm = null;
          this.initTreatmentForm(0);
          this.loadMyTreatments();
          if (this.selectedPatient) {
            this.loadPatientTreatments(this.selectedPatient.patientId);
          }
          this.toastService.showSuccess('Treatment added successfully');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toastService.showError(err.error?.message || 'Failed to add treatment');
        }
      });
  }

  updateTreatmentStatus(treatmentId: number, status: string) {
    if (this.updatingTreatmentIds.has(treatmentId)) return;

    this.updatingTreatmentIds.add(treatmentId);
    this.http.patch<any>(`http://localhost:9090/treatments/${treatmentId}/${status}`, {}, { headers: this.headers })
      .pipe(
        finalize(() => {
          this.updatingTreatmentIds.delete(treatmentId);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Treatment status updated successfully');
          if (this.selectedPatient) {
            this.loadPatientTreatments(this.selectedPatient.patientId);
          }
          this.loadMyTreatments();
        },
        error: (err) => {
          this.toastService.showError(err.error?.message || 'Failed to update treatment status');
          this.cdr.detectChanges();
        }
      });
  }

  isTreatmentUpdateInFlight(treatmentId: number): boolean {
    return this.updatingTreatmentIds.has(treatmentId);
  }

  updatePatientStatus(patientId: number, status: string) {
    this.http.patch<any>(`http://localhost:9090/patients/${patientId}/status?status=${status}`, {}, { headers: this.headers })
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Patient status updated successfully');
          this.loadPatients();
          if (this.selectedPatient && this.selectedPatient.patientId === patientId) {
            this.selectedPatient = { ...this.selectedPatient, status: status as any };
          }
          this.statusHighlight = true;
          this.cdr.detectChanges();
          setTimeout(() => { this.statusHighlight = false; this.cdr.detectChanges(); }, 1600);
        },
        error: (err) => {
          this.toastService.showError(err.error?.message || 'Failed to update patient status');
          this.cdr.detectChanges();
        }
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

  loadAssignedDoctor(patientId: number) {
    this.http.get<any>(`http://localhost:9090/patients/${patientId}/treatments`, { headers: this.headers })
      .subscribe({
        next: d => {
          const treatments = d?.data ?? d;
          if (treatments && treatments.length > 0) {
            const latestTreatment = treatments[0];
            if (latestTreatment.assignedById) {
              this.loadDoctorName(patientId, latestTreatment.assignedById);
            }
          } else {
            this.patientDoctorMap.set(patientId, 'Not assigned');
          }
        },
        error: () => {
          this.patientDoctorMap.set(patientId, 'Unknown');
        }
      });
  }

  loadDoctorName(patientId: number, doctorId: number) {
    this.http.get<any>(`http://localhost:9090/staff/${doctorId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          const staff = d?.data ?? d;
          this.patientDoctorMap.set(patientId, staff.name);
          this.cdr.detectChanges();
        },
        error: () => {
          this.http.get<any>(`http://localhost:9090/admin/users/${doctorId}`, { headers: this.headers })
            .subscribe({
              next: d => {
                const user = d?.data ?? d;
                this.patientDoctorMap.set(patientId, user.name);
                this.cdr.detectChanges();
              },
              error: () => {
                this.patientDoctorMap.set(patientId, 'Unknown Doctor');
                this.cdr.detectChanges();
              }
            });
        }
      });
  }

  getAssignedDoctorName(patientId: number): string {
    return this.patientDoctorMap.get(patientId) || 'Loading...';
  }
}

