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

@Component({
  selector: 'app-doctor',
  imports: [FormsModule, CommonModule, Navbar, DatePipe],
  templateUrl: './doctor.html',
  styleUrl: './doctor.css',
})
export class DoctorDashboard implements OnInit {
  activeTab = 'overview';
  patients: Patient[] = [];
  filteredPatients: Patient[] = [];
  myTreatments: Treatment[] = [];
  notifications: Notification[] = [];
  unreadCount = 0;
  selectedPatient: Patient | null = null;
  citizenDetails: any = null;
  emergencyDetails: any = null;
  patientTreatments: Treatment[] = [];
  expandedPatientId: number | null = null;
  showTreatmentForm: number | null = null;
  statusFilter: PatientStatus | 'ALL' = 'ALL';
  patientStatusOptions: PatientStatus[] = [PatientStatus.ADMITTED, PatientStatus.UNDER_TREATMENT, PatientStatus.DISCHARGED, PatientStatus.CRITICAL];
  patientDoctorMap: Map<number, string> = new Map();

  get admittedCount() { return this.patients.filter(p => p.status === 'ADMITTED').length; }
  get criticalCount() { return this.patients.filter(p => p.status === 'CRITICAL').length; }

  treatmentForm: TreatmentRequest = { patientId: 0, description: '', medicationName: '', dosage: '' };
  errorMsg = '';

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private patientService: PatientService,
    private treatmentService: TreatmentService,
    private notificationService: NotificationService,
    private auth: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadPatients();
    this.loadMyTreatments();
    this.loadNotifications();
  }

  loadPatients() {
    this.patientService.getAllPatients().subscribe({
      next: d => {
        this.patients = d;
        this.applyFilter();
        // Load assigned doctor for each patient
        this.patients.forEach(p => this.loadAssignedDoctor(p.patientId));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load patients:', err);
      }
    });
  }

  loadMyTreatments() {
    const doctorId = this.auth.getUser()?.id;
    if (!doctorId) return;
    
    this.treatmentService.getTreatmentsByDoctorId(doctorId).subscribe({
      next: d => {
        this.myTreatments = d;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load treatments:', err)
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

  applyFilter() {
    if (this.statusFilter === 'ALL') {
      this.filteredPatients = [...this.patients];
    } else {
      this.filteredPatients = this.patients.filter(p => p.status === this.statusFilter);
    }
  }

  onFilterChange() {
    this.applyFilter();
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
    this.selectedPatient = patient;
    this.showTreatmentForm = null;
    this.citizenDetails = null;
    this.emergencyDetails = null;
    this.loadPatientTreatments(patient.patientId);
    this.loadCitizenDetails(patient.citizenId);
    this.loadEmergencyDetails(patient.emergencyId);
    this.activeTab = 'patientDetail';
  }

  loadPatientTreatments(patientId: number) {
    this.treatmentService.getTreatmentsByPatient(patientId).subscribe({
      next: d => {
        this.patientTreatments = d;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load treatments:', err)
    });
  }

  loadCitizenDetails(citizenId: number) {
    this.http.get<any>(`http://localhost:9090/api/citizens/${citizenId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.citizenDetails = d?.data ?? d;
          this.cdr.detectChanges();
        },
        error: () => console.error('Failed to load citizen details')
      });
  }

  loadEmergencyDetails(emergencyId: number) {
    this.http.get<any>(`http://localhost:9090/emergencies/${emergencyId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.emergencyDetails = d?.data ?? d;
          this.cdr.detectChanges();
        },
        error: () => console.error('Failed to load emergency details')
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
    if (!this.treatmentForm.description) {
      this.errorMsg = 'Description is required';
      return;
    }

    this.treatmentService.addTreatment(this.treatmentForm).subscribe({
      next: () => {
        this.closeTreatmentForm();
        this.loadMyTreatments();
        this.loadPatientTreatments(this.treatmentForm.patientId);
        this.errorMsg = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = 'Failed to add treatment: ' + (err.error?.message || err.message);
      }
    });
  }

  updatePatientStatus(patientId: number, newStatus: PatientStatus) {
    this.patientService.updatePatientStatus(patientId, newStatus).subscribe({
      next: () => {
        this.loadPatients();
        if (this.selectedPatient?.patientId === patientId) {
          this.selectedPatient.status = newStatus;
        }
        this.errorMsg = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = 'Failed to update status: ' + (err.error?.message || err.message);
      }
    });
  }

  goBack() {
    this.selectedPatient = null;
    this.activeTab = 'overview';
  }

  backToPatients() {
    this.activeTab = 'patients';
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
          if (this.selectedPatient) {
            this.loadPatientTreatments(this.selectedPatient.patientId);
          }
          this.loadMyTreatments();
        },
        error: (err) => {
          this.errorMsg = err.error?.message || 'Failed to update treatment status';
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
