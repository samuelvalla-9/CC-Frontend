import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { PatientService, TreatmentService, TreatmentRequest } from '../services/patient.service';
import { NotificationService } from '../services/notification.service';
import { Patient, Treatment, PatientStatus } from '../../models/patient.model';
import { Notification } from '../../models/notification.model';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-doctor',
  imports: [FormsModule, CommonModule, Navbar, DatePipe],
  templateUrl: './doctor.html',
  styleUrl: './doctor.css',
})
export class DoctorDashboard implements OnInit {
  activeTab = 'overview';
  patients: Patient[] = [];
  myPatients: Patient[] = [];
  filteredMyPatients: Patient[] = [];
  assignedPatientIds: Set<number> = new Set();
  myTreatments: Treatment[] = [];
  notifications: Notification[] = [];
  unreadCount = 0;
  selectedPatient: Patient | null = null;
  citizenDetails: any = null;
  emergencyDetails: any = null;
  patientTreatments: Treatment[] = [];
  expandedPatientId: number | null = null;
  showTreatmentForm: number | null = null;
  myPatientsStatusFilter: PatientStatus | 'ALL' = 'ALL';
  patientDoctorMap: Map<number, string> = new Map();
  statusHighlight = false;
  private previousTab: string = 'patients';
  private staffFacilityId: number | null = null;
  staffFacilityName: string = '';

  get admittedCount() { return this.patients.filter(p => p.status === 'ADMITTED').length; }
  get criticalCount() { return this.patients.filter(p => p.status === 'CRITICAL').length; }

  treatmentForm: TreatmentRequest = { patientId: 0, description: '', medicationName: '', dosage: '' };
  errorMsg = '';
  isSubmittingTreatment = false;

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private patientService: PatientService,
    private treatmentService: TreatmentService,
    private notificationService: NotificationService,
    public auth: AuthService,
    private http: HttpClient,
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
    if (tab === 'myPatients') this.loadPatients();
    if (tab === 'myTreatments') this.loadMyTreatments();
    if (tab === 'notifications') this.loadNotifications();
  }

  loadPatients() {
    const doctorId = this.auth.getUser()?.id;
    if (!doctorId) return;

    const loadUnassigned = (facilityId?: number) => {
      const unassigned$ = facilityId
        ? this.patientService.getUnassignedPatientsByFacility(facilityId)
        : this.patientService.getUnassignedPatients();

      const myPatients$ = facilityId
        ? this.patientService.getPatientsByFacilityAndDoctor(facilityId, doctorId)
        : this.patientService.getPatientsByDoctor(doctorId);

      unassigned$.subscribe({
        next: d => {
          this.patients = d;
          d.forEach(p => this.loadAssignedDoctor(p.patientId));
          this.cdr.detectChanges();
        },
        error: () => this.toastService.showError('Failed to load patients')
      });

      myPatients$.subscribe({
        next: d => {
          this.myPatients = d;
          this.assignedPatientIds = new Set(d.map(p => p.patientId));
          this.applyMyPatientsFilter();
          this.cdr.detectChanges();
        },
        error: () => { this.myPatients = []; }
      });
    };

    if (this.staffFacilityId) {
      loadUnassigned(this.staffFacilityId);
    } else {
      this.http.get<any>(`http://localhost:9090/staff/${doctorId}`, { headers: this.headers }).subscribe({
        next: (res) => {
          const staff = res?.data ?? res;
          this.staffFacilityId = staff.facilityId;
          if (staff.facilityId && !this.staffFacilityName) {
            this.http.get<any>(`http://localhost:9090/facilities/${staff.facilityId}`, { headers: this.headers }).subscribe({
              next: (fRes) => {
                const facility = fRes?.data ?? fRes;
                this.staffFacilityName = facility?.name || 'Facility #' + staff.facilityId;
                this.cdr.detectChanges();
              },
              error: () => { this.staffFacilityName = 'Facility #' + staff.facilityId; }
            });
          }
          loadUnassigned(this.staffFacilityId ?? undefined);
        },
        error: () => loadUnassigned()
      });
    }
  }

  loadMyTreatments() {
    const doctorId = this.auth.getUser()?.id;
    if (!doctorId) return;
    
    this.treatmentService.getTreatmentsByDoctorId(doctorId).subscribe({
      next: d => {
        this.myTreatments = d;
        this.cdr.detectChanges();
      },
      error: (err) => this.toastService.showError('Failed to load treatments')
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

  applyMyPatientsFilter() {
    if (this.myPatientsStatusFilter === 'ALL') {
      this.filteredMyPatients = [...this.myPatients];
    } else {
      this.filteredMyPatients = this.myPatients.filter(p => p.status === this.myPatientsStatusFilter);
    }
  }

  onMyPatientsFilterChange() {
    this.applyMyPatientsFilter();
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

  togglePatientDetails(patient: Patient) {
    this.previousTab = this.activeTab;
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
    this.treatmentService.getTreatmentsByPatient(patientId).subscribe({
      next: d => {
        this.patientTreatments = d ?? [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.patientTreatments = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadCitizenDetails(citizenId: number) {
    this.http.get<any>(`http://localhost:9090/api/citizens/${citizenId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.citizenDetails = d?.data ?? d;
          this.cdr.detectChanges();
        },
        error: () => this.toastService.showError('Failed to load citizen details')
      });
  }

  loadEmergencyDetails(emergencyId: number) {
    this.http.get<any>(`http://localhost:9090/emergencies/${emergencyId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.emergencyDetails = d?.data ?? d;
          this.cdr.detectChanges();
        },
        error: () => this.toastService.showError('Failed to load emergency details')
      });
  }

  openTreatmentForm(patient: Patient) {
    this.showTreatmentForm = patient.patientId;
    this.treatmentForm = {
      patientId: patient.patientId,
      description: '',
      medicationName: '',
      dosage: ''
    };
  }

  closeTreatmentForm() {
    this.showTreatmentForm = null;
    this.treatmentForm = { patientId: 0, description: '', medicationName: '', dosage: '' };
  }

  submitTreatment() {
    if (this.isSubmittingTreatment) return;
    if (!this.treatmentForm.description) {
      this.toastService.showError('Description is required');
      return;
    }

    this.isSubmittingTreatment = true;
    this.treatmentService.addTreatment(this.treatmentForm).subscribe({
      next: () => {
        this.isSubmittingTreatment = false;
        this.toastService.showSuccess('Treatment added successfully');
        this.closeTreatmentForm();
        this.loadMyTreatments();
        if (this.selectedPatient) {
          this.loadPatientTreatments(this.selectedPatient.patientId);
          // Auto-update patient status to UNDER_OBSERVATION
          if (this.selectedPatient.status === 'ADMITTED') {
            this.updatePatientStatus(this.selectedPatient.patientId, 'UNDER_OBSERVATION' as PatientStatus);
          }
        }
        this.loadPatients();
        this.errorMsg = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSubmittingTreatment = false;
        this.toastService.showError(err.error?.message || 'Failed to add treatment');
      }
    });
  }

  updatePatientStatus(patientId: number, newStatus: PatientStatus) {
    this.patientService.updatePatientStatus(patientId, newStatus).subscribe({
      next: () => {
        this.toastService.showSuccess('Patient status updated successfully');
        this.loadPatients();
        if (this.selectedPatient?.patientId === patientId) {
          this.selectedPatient.status = newStatus;
        }
        this.statusHighlight = true;
        this.cdr.detectChanges();
        setTimeout(() => { this.statusHighlight = false; this.cdr.detectChanges(); }, 1600);
      },
      error: (err) => {
        this.toastService.showError('Failed to update status: ' + (err.error?.message || err.message));
      }
    });
  }

  goBack() {
    this.selectedPatient = null;
    this.setTab(this.previousTab || 'patients');
  }

  backToPatients() {
    this.setTab(this.previousTab || 'patients');
    this.selectedPatient = null;
    this.citizenDetails = null;
    this.emergencyDetails = null;
    this.showTreatmentForm = null;
    this.patientTreatments = [];
    this.errorMsg = '';
  }

  cancelTreatmentForm() {
    this.showTreatmentForm = null;
    this.treatmentForm = { patientId: 0, description: '', medicationName: '', dosage: '' };
    this.errorMsg = '';
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
          this.patientDoctorMap.set(patientId, 'Not assigned');
          this.cdr.detectChanges();
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

