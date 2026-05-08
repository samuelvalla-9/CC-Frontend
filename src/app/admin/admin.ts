import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { ToastComponent } from '../shared/toast';
import { ConfirmDialogService } from '../shared/confirm-dialog';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, Navbar, ToastComponent],
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
  documentIsImage = false;
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

  // Toggle states for inline forms
  showAddFacility = false;
  showAddUser = false;
  showAdmitPatient = false;
  isSubmitting = false;
  isSavingFacility = false;
  isRegisteringAmbulance = false;
  isAdmittingPatient = false;

  // Expose enums to template
  FacilityStatus = FacilityStatus;
  FacilityType = FacilityType;

  facilityForm!: FormGroup;
  editFacilityForm!: FormGroup;
  userForm!: FormGroup;
  ambulanceForm!: FormGroup;
  admitForm = { citizenId: 0, emergencyId: 0, ward: '', notes: '' };

  private get headers() {
    const userId = this.auth.getUser()?.id;
    return new HttpHeaders({
      Authorization: `Bearer ${this.auth.getToken()}`,
      'X-Auth-UserId': userId?.toString() || ''
    });
  }

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private adminService: AdminService,
    private citizenService: CitizenService,
    private notificationService: NotificationService,
    private facilityService: FacilityService,
    private ambulanceService: AmbulanceService,
    private verificationService: VerificationService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder
  ) {
    this.pendingCount$ = this.verificationService.pendingCount$;
    this.initForms();
  }

  private initForms() {
    this.facilityForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      type: [FacilityType.HOSPITAL, Validators.required],
      location: ['', Validators.required],
      capacity: [0, [Validators.required, Validators.min(0)]],
      status: [FacilityStatus.ACTIVE]
    });
    this.editFacilityForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      type: [FacilityType.HOSPITAL, Validators.required],
      location: ['', Validators.required],
      capacity: [0, [Validators.required, Validators.min(0)]]
    });
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/^[A-Za-z\s]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      role: ['', Validators.required]
    });
    this.ambulanceForm = this.fb.group({
      vehicleNumber: ['', [Validators.required, Validators.pattern(/^[A-Z]{2,4}-\d{2,4}$/), Validators.minLength(4), Validators.maxLength(10)]],
      model: ['', Validators.maxLength(50)],
      facilityId: [null]
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.handleTabChange(this.activeTab);
      }
    });

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

  setTab(tab: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  private handleTabChange(tab: string) {
    if (tab === 'notifications') this.loadNotifications();
    if (tab === 'patientsManagement') this.loadPatients();
    if (tab === 'admitPatient') this.loadDispatchedEmergencies();
    if (tab === 'pendingDocs') this.loadPendingVerifications();
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
    this.editFacilityForm.patchValue({
      name: facility.name,
      type: facility.type,
      location: facility.location,
      capacity: facility.capacity
    });
    this.isEditingFacility = true;
    this.setTab('editFacility');
  }

  cancelEditFacility() {
    this.selectedFacility = null;
    this.isEditingFacility = false;
    this.setTab('facilities');
  }

  submitEditFacility() {
    if (!this.selectedFacility) return;
    if (this.isSavingFacility) return;
    if (this.editFacilityForm.invalid) {
      this.editFacilityForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }

    this.isSavingFacility = true;
    this.facilityService.updateFacility(this.selectedFacility.facilityId, this.editFacilityForm.value).subscribe({
      next: () => {
        this.isSavingFacility = false;
        this.toastService.showSuccess('Facility updated successfully');
        this.loadFacilities();
        this.cancelEditFacility();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSavingFacility = false;
        this.toastService.showError('Failed to update facility');
      }
    });
  }

  updateFacilityStatus(facilityId: number, newStatus: FacilityStatus) {
    this.facilityService.updateFacilityStatus(facilityId, newStatus).subscribe({
      next: () => {
        this.toastService.showSuccess('Facility status updated successfully');
        this.loadFacilities();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.toastService.showError('Failed to update facility status');
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
        this.toastService.showError('Failed to load users: ' + (e.error?.message || e.message));
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
    this.citizenService.getCitizenById(patient.citizenId)
      .subscribe({
        next: d => {
          patient.name = d.name;
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
    this.citizenService.getCitizenById(emergency.citizenId)
      .subscribe({
        next: d => {
          emergency.reportedBy = d.name;
          this.cdr.detectChanges();
        },
        error: () => {
          emergency.reportedBy = 'Unknown Citizen';
          this.cdr.detectChanges();
        }
      });
  }

  async dischargePatient(patientId: number) {
    const patient = this.patients.find((p: any) => p.patientId === patientId);
    if (patient && patient.status !== 'STABLE') {
      this.toastService.showError(`Cannot discharge: Patient is currently "${patient.status}". Patient must be in STABLE condition before discharge.`);
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Discharge Patient',
      message: 'Are you sure you want to discharge this patient? This action cannot be undone.',
      confirmText: 'Discharge',
      type: 'warning'
    });
    if (!confirmed) return;

    this.http.patch<any>(`http://localhost:9090/patients/${patientId}/status?status=DISCHARGED`, {}, { headers: this.headers })
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Patient discharged successfully');
          this.loadPatients();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.toastService.showError('Failed to discharge patient: ' + (err.error?.message || err.message));
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
    if (this.isSavingFacility) return;
    if (this.facilityForm.invalid) {
      this.facilityForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }
    this.isSavingFacility = true;
    this.facilityService.createFacility(this.facilityForm.value).subscribe({
      next: () => {
        this.isSavingFacility = false;
        this.facilityForm.reset({ name: '', type: FacilityType.HOSPITAL, location: '', capacity: 0, status: FacilityStatus.ACTIVE });
        this.showAddFacility = false;
        this.toastService.showSuccess('Facility added successfully');
        this.loadFacilities();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSavingFacility = false;
        this.toastService.showError('Failed to add facility');
      }
    });
  }

  toggleAddFacility() {
    this.showAddFacility = !this.showAddFacility;
  }

  addUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const formValue = this.userForm.value;
    if (!formValue.role) {
      this.toastService.showError('Please select a role');
      return;
    }

    let observable;
    switch (formValue.role) {
      case 'DOCTOR':
      case 'NURSE':
        observable = this.adminService.createStaff(formValue);
        break;
      case 'DISPATCHER':
        observable = this.adminService.createDispatcher(formValue);
        break;
      case 'COMPLIANCE_OFFICER':
        observable = this.adminService.createComplianceOfficer(formValue);
        break;
      case 'CITY_HEALTH_OFFICER':
        observable = this.adminService.createHealthOfficer(formValue);
        break;
      default:
        this.toastService.showError('Invalid role selected');
        return;
    }

    observable.subscribe({
      next: () => {
        this.userForm.reset({ name: '', email: '', password: '', phone: '', role: '' });
        this.showAddUser = false;
        this.isSubmitting = false;
        this.toastService.showSuccess('User created successfully');
        this.loadUsers();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.toastService.showError('Failed to add user');
      }
    });
  }

  toggleAddUser() {
    this.showAddUser = !this.showAddUser;
  }

  registerAmbulance() {
    if (this.isRegisteringAmbulance) return;
    if (this.ambulanceForm.invalid) {
      this.ambulanceForm.markAllAsTouched();
      this.toastService.showError('Vehicle number is required');
      return;
    }
    this.isRegisteringAmbulance = true;
    this.http.post<any>('http://localhost:9090/emergencies/admin/ambulances', this.ambulanceForm.value, { headers: this.headers })
      .subscribe({
        next: () => { this.isRegisteringAmbulance = false; this.ambulanceForm.reset({ vehicleNumber: '', model: '', facilityId: null }); this.toastService.showSuccess('Ambulance registered successfully'); this.loadAmbulances(); },
        error: (err) => { this.isRegisteringAmbulance = false; this.toastService.showError(err.error?.message || 'Failed to register ambulance') }
      });
  }

  updateAmbulanceStatus(id: number, status: string) {
    this.ambulanceService.updateAmbulanceStatus(id, status).subscribe({
      next: () => {
        this.toastService.showSuccess('Ambulance status updated');
        this.loadAmbulances();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.toastService.showError('Failed to update ambulance status');
      }
    });
  }

  async removeAmbulance(ambulance: any) {
    if (ambulance.status === 'DISPATCHED') {
      this.toastService.showError('Cannot remove an ambulance that is currently dispatched');
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove Ambulance',
      message: `Are you sure you want to remove ambulance ${ambulance.vehicleNumber}? This action cannot be undone.`,
      confirmText: 'Remove',
      type: 'warning'
    });
    if (!confirmed) return;

    this.ambulanceService.deleteAmbulance(ambulance.ambulanceId).subscribe({
      next: () => {
        this.toastService.showSuccess('Ambulance removed successfully');
        this.loadAmbulances();
      },
      error: (err: any) => {
        this.toastService.showError(err.error?.message || 'Failed to remove ambulance');
      }
    });
  }

  getFacilityName(facilityId: number): string {
    const facility = this.facilities.find(f => f.facilityId === facilityId);
    return facility ? facility.name : `Facility #${facilityId}`;
  }

  admitPatient() {
    if (this.isAdmittingPatient) return;
    const payload = {
      citizenId: this.admitForm.citizenId,
      emergencyId: this.admitForm.emergencyId,
      ward: this.admitForm.ward,
      notes: this.admitForm.notes
    };
    this.isAdmittingPatient = true;
    this.http.post<any>('http://localhost:9090/patients/admit', payload, { headers: this.headers })
      .subscribe({
        next: () => {
          this.isAdmittingPatient = false;
          this.admitForm = { citizenId: 0, emergencyId: 0, ward: '', notes: '' };
          this.showAdmitPatient = false;
          this.toastService.showSuccess('Patient admitted successfully');
          this.loadPatients();
          this.loadDispatchedEmergencies();
        },
        error: (err: any) => {
          this.isAdmittingPatient = false;
          const errorMessage = err.error?.message || err.message;
          this.toastService.showError(errorMessage);
          this.cdr.markForCheck();
        }
      });
  }

  toggleAdmitPatient() {
    this.showAdmitPatient = !this.showAdmitPatient;
    if (this.showAdmitPatient) {
      this.loadDispatchedEmergencies();
    }
  }

  cancelAdmit() {
    this.admitForm = { citizenId: 0, emergencyId: 0, ward: '', notes: '' };
  }

  prepareAdmit(emergency: any) {
    this.admitForm.citizenId = emergency.citizenId;
    this.admitForm.emergencyId = emergency.emergencyId;
    this.admitForm.ward = '';
    this.admitForm.notes = `Emergency: ${emergency.type} at ${emergency.location}`;
  }

  activateUser(userId: number) {
    const id = userId || (this.selectedUser?.userId ?? this.selectedUser?.id);
    this.adminService.activateUser(id!).subscribe({
      next: () => {
        this.toastService.showSuccess('User activated successfully');
        this.users = this.users.map(u =>
          (u.userId || u.id) === id ? { ...u, status: 'ACTIVE' as const } : u
        );
        if (this.selectedUser && (this.selectedUser.userId === id || this.selectedUser.id === id)) {
          this.selectedUser = { ...this.selectedUser, status: 'ACTIVE' };
        }
        this.cdr.markForCheck();
      },
      error: () => this.toastService.showError('Failed to activate user')
    });
  }

  async deactivateUser(userId: number) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Deactivate User',
      message: 'Are you sure you want to deactivate this user? They will no longer be able to access the system.',
      confirmText: 'Deactivate',
      type: 'warning'
    });
    if (!confirmed) return;

    const id = userId || (this.selectedUser?.userId ?? this.selectedUser?.id);
    this.adminService.deactivateUser(id!).subscribe({
      next: () => {
        this.toastService.showSuccess('User deactivated successfully');
        this.users = this.users.map(u =>
          (u.userId || u.id) === id ? { ...u, status: 'INACTIVE' as const } : u
        );
        if (this.selectedUser && (this.selectedUser.userId === id || this.selectedUser.id === id)) {
          this.selectedUser = { ...this.selectedUser, status: 'INACTIVE' };
        }
        this.cdr.markForCheck();
      },
      error: () => this.toastService.showError('Failed to deactivate user')
    });
  }

  viewUserDetails(user: User) {
    this.selectedUser = user;
    this.setTab('userDetail');
  }

  async verifyDocument(docId: number, status: 'VERIFIED' | 'REJECTED') {
    if (status === 'REJECTED') {
      const confirmed = await this.confirmDialog.confirm({
        title: 'Reject Document',
        message: 'Are you sure you want to reject this document? The citizen will need to re-upload.',
        confirmText: 'Reject',
        type: 'danger'
      });
      if (!confirmed) return;
    }

    this.citizenService.verifyDocument(docId, status).subscribe({
      next: () => {
        this.toastService.showSuccess(`Document ${status.toLowerCase()} successfully`);
        this.citizenDocuments = this.citizenDocuments.map(d =>
          d.documentId === docId ? { ...d, verificationStatus: status } : d
        );
        this.verificationService.refreshVerifications();
      },
      error: () => this.toastService.showError('Failed to verify document')
    });
  }

  loadCitizensWithPendingDocs() {
    this.verificationService.loadPendingVerifications().subscribe();
  }

  loadPendingVerifications() {
    this.verificationService.loadPendingVerifications().subscribe();
  }

  navigateToPendingDocs() {
    this.setTab('pendingDocs');
    this.loadPendingVerifications();
  }

  viewCitizenDocuments(citizen: PendingCitizen) {
    this.selectedCitizen = citizen;
    this.citizenDocuments = [];
    this.documentPreviewUrl = null;
    this.setTab('verifyDocuments');
    this.cdr.markForCheck();

    this.http.get<any>(`http://localhost:9090/api/citizens/${citizen.citizenId}/documents`, { headers: this.headers })
      .subscribe({
        next: res => {
          this.citizenDocuments = res?.data ?? res;
          this.cdr.markForCheck();
        },
        error: () => {
          this.toastService.showError('Failed to load documents');
          this.cdr.markForCheck();
        }
      });
  }

  previewDocument(doc: any) {
    if (!this.selectedCitizen) {
      this.toastService.showError('No citizen selected');
      return;
    }

    this.isLoadingDocument = true;
    this.documentPreviewUrl = null;
    this.documentIsImage = false;
    this.selectedDocument$.next(doc);
    this.cdr.markForCheck();

    this.citizenService.getDocumentBlob(this.selectedCitizen.citizenId, doc.documentId)
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          this.documentIsImage = blob.type.startsWith('image/');
          this.documentPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoadingDocument = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.toastService.showError('Failed to load document');
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
    this.setTab('patientDetail');

    // Load citizen details
    this.citizenService.getCitizenById(patient.citizenId)
      .subscribe({
        next: d => {
          this.patientCitizenDetails = d;
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
    this.setTab('patientsManagement');
  }

  navigateToAdmitPatient() {
    this.setTab('patientsManagement');
    this.showAdmitPatient = true;
    this.loadDispatchedEmergencies();
  }
}
