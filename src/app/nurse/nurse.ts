import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { ToastComponent } from '../shared/toast';
import { NotificationService } from '../services/notification.service';
import { Patient, Treatment, PatientStatus, TreatmentStatus } from '../../models/patient.model';
import { Notification } from '../../models/notification.model';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-nurse',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, Navbar, DatePipe, ToastComponent],
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

  get admittedCount() { return this.patients.filter(p => p.status === PatientStatus.ADMITTED).length; }
  get criticalCount() { return this.patients.filter(p => p.status === PatientStatus.CRITICAL).length; }

  treatmentForm!: FormGroup;
  errorMsg = '';
  isSubmittingTreatment = false;

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient, 
    private auth: AuthService,
    private toastService: ToastService, 
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
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

  loadPatients() {
    this.http.get<any>('http://localhost:9090/patients', { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.patients = d?.data ?? d;
          this.patients.forEach(p => this.loadAssignedDoctor(p.patientId));
          this.cdr.detectChanges();
        }, 
        error: () => {} 
      });
  }

  loadMyTreatments() {
    const nurseId = this.auth.getUser()?.id;
    this.http.get<any>(`http://localhost:9090/treatments/assigned-by/${nurseId}`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.myTreatments = d?.data ?? d;
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

  togglePatientDetails(patient: Patient) {
    this.selectedPatient = patient;
    this.showTreatmentForm = null;
    this.citizenDetails = null;
    this.emergencyDetails = null;
    this.loadPatientTreatments(patient.patientId);
    this.loadCitizenDetails(patient.citizenId);
    this.loadEmergencyDetails(patient.emergencyId);
    this.setTab('patientDetail');
  }

  loadPatientTreatments(patientId: number) {
    this.http.get<any>(`http://localhost:9090/patients/${patientId}/treatments`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.patientTreatments = d?.data ?? d;
          this.cdr.detectChanges();
        }, 
        error: () => {} 
      });
  }

  loadCitizenDetails(citizenId: number) {
    this.http.get<any>(`http://localhost:9090/api/citizens/${citizenId}`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.citizenDetails = d?.data ?? d;
          this.cdr.detectChanges();
        }, 
        error: () => {} 
      });
  }

  loadEmergencyDetails(emergencyId: number) {
    this.http.get<any>(`http://localhost:9090/emergencies/${emergencyId}`, { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.emergencyDetails = d?.data ?? d;
          this.cdr.detectChanges();
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
      .subscribe({
        next: () => { 
          this.isSubmittingTreatment = false; 
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
          this.isSubmittingTreatment = false;
          this.toastService.showError(err.error?.message || 'Failed to add treatment');
        }
      });
  }

  updateTreatmentStatus(treatmentId: number, status: string) {
    this.http.patch<any>(`http://localhost:9090/treatments/${treatmentId}/${status}`, {}, { headers: this.headers })
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

