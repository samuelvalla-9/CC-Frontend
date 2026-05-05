import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { AdminService, CreateStaffRequest } from '../services/admin.service';
import { CitizenService } from '../services/citizen.service';
import { NotificationService } from '../services/notification.service';
import { FacilityService, AmbulanceService } from '../services/facility.service';
import { VerificationService, PendingCitizen } from '../services/verification.service';
import { Facility, Ambulance, FacilityStatus, FacilityType } from '../../models/facility.model';
import { User } from '../../models/user.model';
import { Patient } from '../../models/patient.model';
import { Notification } from '../../models/notification.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, CommonModule, Navbar],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminDashboard implements OnInit {
  activeTab = 'overview';
  facilities: Facility[] = [];
  filteredFacilities: Facility[] = [];
  ambulances: Ambulance[] = [];
  users: User[] = [];
  patients: Patient[] = [];
  patientDoctorMap: Map<number, string> = new Map();
  dispatchedEmergencies: any[] = [];
  pendingDocuments: PendingCitizen[] = [];
  notifications: Notification[] = [];
  unreadCount = 0;
  pendingCount$;
  selectedCitizen: any = null;
  citizenDocuments: any[] = [];
  selectedDocument$ = new BehaviorSubject<any>(null);
  documentPreviewUrl: SafeResourceUrl | null = null;
  isLoadingDocument = false;
  selectedUser: User | null = null;
  selectedFacility: Facility | null = null;
  isEditingFacility = false;
  facilityStatusFilter: FacilityStatus | 'ALL' = 'ALL';
  selectedPatient: Patient | null = null;
  patientCitizenDetails: any = null;
  patientEmergencyDetails: any = null;
  patientTreatments: any[] = [];
  errorMsg = '';

  // Expose enums to template
  FacilityStatus = FacilityStatus;
  FacilityType = FacilityType;

  facilityForm = { name: '', type: FacilityType.HOSPITAL, location: '', capacity: 0 };
  editFacilityForm = { name: '', type: FacilityType.HOSPITAL, location: '', capacity: 0 };
  userForm: CreateStaffRequest = { name: '', email: '', password: '', phone: '', role: '' };
  staffForm: CreateStaffRequest = { name: '', email: '', password: '', phone: '', role: 'DOCTOR' };
  dispatcherForm: CreateStaffRequest = { name: '', email: '', password: '', phone: '' };
  complianceForm: CreateStaffRequest = { name: '', email: '', password: '', phone: '' };
  healthOfficerForm: CreateStaffRequest = { name: '', email: '', password: '', phone: '' };
  ambulanceForm = { vehicleNumber: '', model: '' };
  admitForm = { citizenId: 0, emergencyId: 0, ward: '', notes: '' };

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private adminService: AdminService,
    private citizenService: CitizenService,
    private notificationService: NotificationService,
    private facilityService: FacilityService,
    private ambulanceService: AmbulanceService,
    private verificationService: VerificationService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {
    this.pendingCount$ = this.verificationService.pendingCount$;
  }

  ngOnInit() {
    this.loadFacilities();
    this.loadUsers();
    this.loadPatients();
    this.loadAmbulances();
    this.loadPendingVerifications();
    this.loadDispatchedEmergencies();
    this.loadNotifications();
    
    this.verificationService.pendingCitizens$.subscribe(citizens => {
      this.pendingDocuments = citizens;
      this.cdr.markForCheck();
    });
  }

  loadFacilities() {
    this.facilityService.getAllFacilities().subscribe({
      next: d => {
        this.facilities = d;
        this.applyFacilityFilter();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  applyFacilityFilter() {
    if (this.facilityStatusFilter === 'ALL') {
      this.filteredFacilities = [...this.facilities];
    } else {
      this.filteredFacilities = this.facilities.filter(f => f.status === this.facilityStatusFilter);
    }
  }

  onFacilityFilterChange() {
    this.applyFacilityFilter();
  }

  editFacility(facility: Facility) {
    this.selectedFacility = facility;
    this.editFacilityForm = {
      name: facility.name,
      type: facility.type,
      location: facility.location,
      capacity: facility.capacity
    };
    this.isEditingFacility = true;
    this.activeTab = 'editFacility';
  }

  cancelEditFacility() {
    this.selectedFacility = null;
    this.isEditingFacility = false;
    this.activeTab = 'facilities';
  }

  submitEditFacility() {
    if (!this.selectedFacility) return;
    
    this.facilityService.updateFacility(this.selectedFacility.facilityId, this.editFacilityForm).subscribe({
      next: () => {
        this.loadFacilities();
        this.cancelEditFacility();
        this.errorMsg = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = 'Failed to update facility: ' + (err.error?.message || err.message);
      }
    });
  }

  updateFacilityStatus(facilityId: number, newStatus: FacilityStatus) {
    this.facilityService.updateFacilityStatus(facilityId, newStatus).subscribe({
      next: () => {
        this.loadFacilities();
        this.errorMsg = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = 'Failed to update facility status: ' + (err.error?.message || err.message);
      }
    });
  }

  loadUsers() {
    this.adminService.getAllUsers().subscribe({
      next: d => {
        console.log('Users loaded:', d);
        this.users = d;
      },
      error: e => {
        console.error('Error loading users:', e);
        this.errorMsg = 'Failed to load users: ' + (e.error?.message || e.message);
      }
    });
  }

  loadPatients() {
    this.http.get<any>('http://localhost:9090/patients', { headers: this.headers })
      .subscribe({ 
        next: d => {
          this.patients = d?.data ?? d;
          // Load citizen names and assigned doctors for each patient
          this.patients.forEach(p => {
            this.loadCitizenName(p);
            this.loadAssignedDoctor(p.patientId);
          });
          this.cdr.detectChanges();
        }, 
        error: () => {} 
      });
  }

  loadCitizenName(patient: Patient) {
    this.http.get<any>(`http://localhost:9090/api/citizens/${patient.citizenId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          const citizen = d?.data ?? d;
          patient.name = citizen.name;
          this.cdr.detectChanges();
        },
        error: () => {
          patient.name = 'Unknown Citizen';
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
            // Get the most recent treatment's doctor
            const latestTreatment = treatments[0];
            if (latestTreatment.assignedById) {
              this.loadDoctorName(patientId, latestTreatment.assignedById);
            }
          }
        },
        error: () => {}
      });
  }

  loadDoctorName(patientId: number, doctorId: number) {
    // Try to get staff info first
    this.http.get<any>(`http://localhost:9090/staff/${doctorId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          const staff = d?.data ?? d;
          this.patientDoctorMap.set(patientId, staff.name);
          this.cdr.detectChanges();
        },
        error: () => {
          // Fallback to AuthService if staff record doesn't exist
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

  getAssignedDoctorName(patientId: number): string | undefined {
    return this.patientDoctorMap.get(patientId);
  }

  loadCitizenNameForEmergency(emergency: any) {
    this.http.get<any>(`http://localhost:9090/api/citizens/${emergency.citizenId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          const citizen = d?.data ?? d;
          emergency.reportedBy = citizen.name;
          this.cdr.detectChanges();
        },
        error: () => {
          emergency.reportedBy = 'Unknown Citizen';
          this.cdr.detectChanges();
        }
      });
  }

  dischargePatient(patientId: number) {
    this.http.patch<any>(`http://localhost:9090/patients/${patientId}/status?status=DISCHARGED`, {}, { headers: this.headers })
      .subscribe({
        next: () => {
          this.loadPatients();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.errorMsg = 'Failed to discharge patient: ' + (err.error?.message || err.message);
          this.cdr.detectChanges();
        }
      });
  }

  loadAmbulances() {
    this.ambulanceService.getAllAmbulances().subscribe({
      next: d => {
        this.ambulances = d;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadDispatchedEmergencies() {
    this.http.get<any>('http://localhost:9090/emergencies/dispatched', { headers: this.headers })
      .subscribe({ 
        next: d => {
          const allDispatched = d?.data ?? d;
          // Filter out emergencies that are already admitted by checking if patient exists
          this.http.get<any>('http://localhost:9090/patients', { headers: this.headers })
            .subscribe({
              next: patientsRes => {
                const patients = patientsRes?.data ?? patientsRes;
                const admittedEmergencyIds = patients.map((p: any) => p.emergencyId);
                this.dispatchedEmergencies = allDispatched.filter((e: any) => 
                  !admittedEmergencyIds.includes(e.emergencyId)
                );
                // Load citizen names for each emergency
                this.dispatchedEmergencies.forEach(e => this.loadCitizenNameForEmergency(e));
                this.cdr.markForCheck();
              },
              error: () => {
                this.dispatchedEmergencies = allDispatched;
                this.dispatchedEmergencies.forEach(e => this.loadCitizenNameForEmergency(e));
                this.cdr.markForCheck();
              }
            });
        }, 
        error: () => {} 
      });
  }

  addFacility() {
    this.errorMsg = '';
    this.facilityService.createFacility(this.facilityForm).subscribe({
      next: () => {
        this.facilityForm = { name: '', type: FacilityType.HOSPITAL, location: '', capacity: 0 };
        this.loadFacilities();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = 'Failed to add facility: ' + (err.error?.message || err.message);
      }
    });
  }

  addUser() {
    this.errorMsg = '';
    if (!this.userForm.role) {
      this.errorMsg = 'Please select a role';
      return;
    }

    let observable;
    switch (this.userForm.role) {
      case 'DOCTOR':
      case 'NURSE':
        observable = this.adminService.createStaff(this.userForm);
        break;
      case 'DISPATCHER':
        observable = this.adminService.createDispatcher(this.userForm);
        break;
      case 'COMPLIANCE_OFFICER':
        observable = this.adminService.createComplianceOfficer(this.userForm);
        break;
      case 'CITY_HEALTH_OFFICER':
        observable = this.adminService.createHealthOfficer(this.userForm);
        break;
      default:
        this.errorMsg = 'Invalid role selected';
        return;
    }

    observable.subscribe({
      next: () => {
        this.userForm = { name: '', email: '', password: '', phone: '', role: '' };
        this.loadUsers();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = 'Failed to add user: ' + (err.error?.message || err.message);
      }
    });
  }

  registerAmbulance() {
    this.errorMsg = '';
    this.http.post<any>('http://localhost:9090/emergencies/admin/ambulances', this.ambulanceForm, { headers: this.headers })
      .subscribe({
        next: () => { this.ambulanceForm = { vehicleNumber: '', model: '' }; this.loadAmbulances(); },
        error: () => this.errorMsg = 'Failed to register ambulance'
      });
  }

  admitPatient() {
    this.errorMsg = '';
    const payload = {
      citizenId: this.admitForm.citizenId,
      emergencyId: this.admitForm.emergencyId,
      ward: this.admitForm.ward,
      notes: this.admitForm.notes
    };
    this.http.post<any>('http://localhost:9090/patients/admit', payload, { headers: this.headers })
      .subscribe({
        next: () => { 
          this.admitForm = { citizenId: 0, emergencyId: 0, ward: '', notes: '' }; 
          this.activeTab = 'overview';
          this.loadPatients();
          this.loadDispatchedEmergencies();
        },
        error: (err) => {
          const errorMessage = err.error?.message || err.message;
          this.errorMsg = errorMessage;
          this.cdr.markForCheck();
        }
      });
  }

  prepareAdmit(emergency: any) {
    this.admitForm.citizenId = emergency.citizenId;
    this.admitForm.emergencyId = emergency.emergencyId;
    this.admitForm.ward = '';
    this.admitForm.notes = `Emergency: ${emergency.type} at ${emergency.location}`;
    this.activeTab = 'admitPatient';
  }

  activateUser(userId: number) {
    const id = userId || (this.selectedUser?.userId ?? this.selectedUser?.id);
    this.adminService.activateUser(id!).subscribe({
      next: () => {
        this.users = this.users.map(u => 
          (u.userId || u.id) === id ? { ...u, status: 'ACTIVE' as const } : u
        );
        if (this.selectedUser && (this.selectedUser.userId === id || this.selectedUser.id === id)) {
          this.selectedUser = { ...this.selectedUser, status: 'ACTIVE' };
        }
        this.cdr.markForCheck();
      },
      error: () => this.errorMsg = 'Failed to activate user'
    });
  }

  deactivateUser(userId: number) {
    const id = userId || (this.selectedUser?.userId ?? this.selectedUser?.id);
    this.adminService.deactivateUser(id!).subscribe({
      next: () => {
        this.users = this.users.map(u => 
          (u.userId || u.id) === id ? { ...u, status: 'INACTIVE' as const } : u
        );
        if (this.selectedUser && (this.selectedUser.userId === id || this.selectedUser.id === id)) {
          this.selectedUser = { ...this.selectedUser, status: 'INACTIVE' };
        }
        this.cdr.markForCheck();
      },
      error: () => this.errorMsg = 'Failed to deactivate user'
    });
  }

  viewUserDetails(user: User) {
    this.selectedUser = user;
    this.activeTab = 'userDetail';
  }

  verifyDocument(docId: number, status: 'VERIFIED' | 'REJECTED') {
    this.citizenService.verifyDocument(docId, status).subscribe({
      next: () => {
        this.citizenDocuments = this.citizenDocuments.map(d => 
          d.documentId === docId ? { ...d, verificationStatus: status } : d
        );
        this.verificationService.refreshVerifications();
      },
      error: () => this.errorMsg = 'Failed to verify document'
    });
  }

  loadCitizensWithPendingDocs() {
    this.verificationService.loadPendingVerifications().subscribe();
  }

  loadPendingVerifications() {
    this.verificationService.loadPendingVerifications().subscribe();
  }

  navigateToPendingDocs() {
    this.activeTab = 'pendingDocs';
    this.loadPendingVerifications();
  }

  viewCitizenDocuments(citizen: PendingCitizen) {
    this.selectedCitizen = citizen;
    this.citizenDocuments = [];
    this.documentPreviewUrl = null;
    this.activeTab = 'verifyDocuments';
    this.cdr.markForCheck();
    
    this.http.get<any>(`http://localhost:9090/api/citizens/${citizen.citizenId}/documents`, { headers: this.headers })
      .subscribe({
        next: res => {
          this.citizenDocuments = res?.data ?? res;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMsg = 'Failed to load documents';
          this.cdr.markForCheck();
        }
      });
  }

  previewDocument(doc: any) {
    if (!this.selectedCitizen) {
      console.error('No citizen selected');
      return;
    }
    
    console.log('Previewing document:', doc.documentId, 'for citizen:', this.selectedCitizen.citizenId);
    this.isLoadingDocument = true;
    this.documentPreviewUrl = null;
    this.selectedDocument$.next(doc);
    this.cdr.markForCheck();
    
    this.citizenService.getDocumentBlob(this.selectedCitizen.citizenId, doc.documentId)
      .subscribe({
        next: blob => {
          console.log('Blob received:', blob.size, 'bytes, type:', blob.type);
          const url = URL.createObjectURL(blob);
          console.log('Object URL created:', url);
          this.documentPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoadingDocument = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load document:', err);
          this.errorMsg = 'Failed to load document preview: ' + (err.error?.message || err.message);
          this.isLoadingDocument = false;
          this.cdr.markForCheck();
        }
      });
  }

  trackByUserId(index: number, user: User): number {
    return user.userId || user.id;
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

  viewPatientDetails(patient: Patient) {
    this.selectedPatient = patient;
    this.patientCitizenDetails = null;
    this.patientEmergencyDetails = null;
    this.patientTreatments = [];
    this.activeTab = 'patientDetail';
    
    // Load citizen details
    this.http.get<any>(`http://localhost:9090/api/citizens/${patient.citizenId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.patientCitizenDetails = d?.data ?? d;
          this.cdr.detectChanges();
        },
        error: () => {
          this.patientCitizenDetails = { name: 'Unknown', contactInfo: 'N/A' };
        }
      });
    
    // Load emergency details
    this.http.get<any>(`http://localhost:9090/emergencies/${patient.emergencyId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.patientEmergencyDetails = d?.data ?? d;
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    
    // Load treatments
    this.http.get<any>(`http://localhost:9090/patients/${patient.patientId}/treatments`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.patientTreatments = d?.data ?? d;
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  backToPatientsList() {
    this.selectedPatient = null;
    this.patientCitizenDetails = null;
    this.patientEmergencyDetails = null;
    this.patientTreatments = [];
    this.activeTab = 'patientsManagement';
  }
}
