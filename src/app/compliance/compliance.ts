import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { FacilityService } from '../services/facility.service';
import { PatientService } from '../services/patient.service';
import { EmergencyService } from '../services/emergency.service';
import { NotificationService } from '../services/notification.service';
import { ToastService } from '../services/toast.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-compliance',
  imports: [FormsModule, ReactiveFormsModule, Navbar, DatePipe],
  templateUrl: './compliance.html',
  styleUrl: './compliance.css',
})
export class ComplianceDashboard implements OnInit {
  activeTab = 'overview';
  complianceRecords: any[] = [];
  audits: any[] = [];
  auditLogs: any[] = [];
  facilities: any[] = [];
  patients: any[] = [];
  emergencies: any[] = [];
  entityOptions: any[] = [];
  notifications: any[] = [];
  unreadCount = 0;

  recordForm!: FormGroup;
  auditForm!: FormGroup;
  entityTypes = ['FACILITY', 'PATIENT', 'EMERGENCY'];

  errorMsg = '';
  isCreatingRecord = false;
  isInitiatingAudit = false;

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private facilityService: FacilityService,
    private patientService: PatientService,
    private emergencyService: EmergencyService,
    private notificationService: NotificationService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.initForms();
  }

  private initForms() {
    this.recordForm = this.fb.group({
      entityId: ['', [Validators.required]],
      type: ['FACILITY', Validators.required],
      result: ['', Validators.required],
      notes: ['']
    });
    this.recordForm.get('type')!.valueChanges.subscribe(type => this.onEntityTypeChange(type));
    this.auditForm = this.fb.group({
      scope: ['', Validators.required],
      findings: ['']
    });
  }

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
    this.loadFacilities();
    this.loadPatients();
    this.loadEmergencies();
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

  loadFacilities() {
    this.facilityService.getAllFacilities().subscribe({
      next: d => { console.log('Facilities loaded:', d); this.facilities = d; this.onEntityTypeChange(this.recordForm.get('type')!.value); },
      error: (err) => console.error('Failed to load facilities:', err)
    });
  }

  loadPatients() {
    this.patientService.getAllPatients().subscribe({
      next: d => { this.patients = d; this.onEntityTypeChange(this.recordForm.get('type')!.value); },
      error: () => {}
    });
  }

  loadEmergencies() {
    this.emergencyService.getAllEmergencies().subscribe({
      next: d => { this.emergencies = d; this.onEntityTypeChange(this.recordForm.get('type')!.value); },
      error: () => {}
    });
  }

  onEntityTypeChange(type: string) {
    this.recordForm.get('entityId')!.setValue('');
    if (type === 'FACILITY') {
      this.entityOptions = this.facilities.map(f => ({ id: f.facilityId, label: f.name }));
    } else if (type === 'PATIENT') {
      this.entityOptions = this.patients.map(p => ({ id: p.patientId, label: `#${p.patientId} - ${p.name || 'Patient'} (${p.status})` }));
    } else if (type === 'EMERGENCY') {
      this.entityOptions = this.emergencies.map(e => ({ id: e.emergencyId, label: `#${e.emergencyId} - ${e.type} (${e.date || e.reportedAt})` }));
    }
  }

  loadNotifications() {
    this.notificationService.getMyNotifications().subscribe({
      next: d => { this.notifications = d; this.unreadCount = d.filter((n: any) => n.status === 'UNREAD').length; },
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

  createRecord() {
    if (this.isCreatingRecord) return;
    if (this.recordForm.invalid) {
      this.recordForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }
    this.isCreatingRecord = true;
    this.http.post<any>('http://localhost:9090/compliance/records', this.recordForm.value, { headers: this.headers })
      .subscribe({
        next: () => { this.isCreatingRecord = false; this.recordForm.reset({ entityId: '', type: 'FACILITY', result: '', notes: '' }); this.loadRecords(); this.toastService.showSuccess('Compliance record created successfully'); },
        error: (err) => { this.isCreatingRecord = false; this.toastService.showError(err.error?.message || 'Failed to create record') }
      });
  }

  initiateAudit() {
    if (this.isInitiatingAudit) return;
    if (this.auditForm.invalid) {
      this.auditForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }
    this.isInitiatingAudit = true;
    this.http.post<any>('http://localhost:9090/compliance/audits', this.auditForm.value, { headers: this.headers })
      .subscribe({
        next: () => { this.isInitiatingAudit = false; this.auditForm.reset({ scope: '', findings: '' }); this.loadAudits(); this.toastService.showSuccess('Audit initiated successfully'); },
        error: (err) => { this.isInitiatingAudit = false; this.toastService.showError(err.error?.message || 'Failed to initiate audit') }
      });
  }
}
