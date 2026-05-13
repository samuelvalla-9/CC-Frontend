import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { AdminService, CreateStaffRequest, CreateUserRequest } from '../services/admin.service';
import { CitizenService } from '../services/citizen.service';
import { NotificationService } from '../services/notification.service';
import { FacilityService, AmbulanceService } from '../services/facility.service';
import { VerificationService, PendingCitizen } from '../services/verification.service';
import { Facility, Ambulance, FacilityStatus, FacilityType } from '../../models/facility.model';
import { User } from '../../models/user.model';
import { Patient } from '../../models/patient.model';
import { Notification } from '../../models/notification.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject, forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { ConfirmDialogService } from '../shared/confirm-dialog';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, Navbar],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminDashboard implements OnInit, OnDestroy {
  activeTab = 'overview';
  facilities: Facility[] = [];
  filteredFacilities: Facility[] = [];
  ambulances: Ambulance[] = [];
  users: User[] = [];
  patients: Patient[] = [];
  patientDoctorMap: Map<number, string> = new Map();
  private citizenNameCache: Map<number, string> = new Map();
  private seenNotificationIds = new Set<number>();
  private pendingVerificationRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingVerificationAutoSyncInterval: ReturnType<typeof setInterval> | null = null;
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
  previewingDocId: number | null = null;
  selectedUser: User | null = null;
  userExtraDetails: any = null;
  userDocuments: any[] = [];
  userDocPreviewUrl: SafeResourceUrl | null = null;
  previewingUserDocId: number | null = null;
  userDocIsImage = false;
  isLoadingUserDoc = false;
  private userCitizenId: number | null = null;
  selectedFacility: Facility | null = null;
  isEditingFacility = false;
  facilityStatusFilter: FacilityStatus | 'ALL' = 'ALL';
  selectedPatient: Patient | null = null;
  patientCitizenDetails: any = null;
  patientEmergencyDetails: any = null;
  patientTreatments: any[] = [];
  errorMsg = '';

  // Enterprise grid state (sorting + bulk actions)
  selectedFacilityIds = new Set<number>();
  selectedUserIds = new Set<number>();
  private actionInFlight = new Set<string>();
  facilitySort: { key: 'facilityId' | 'name' | 'type' | 'location' | 'capacity' | 'status'; direction: 'asc' | 'desc' } = { key: 'facilityId', direction: 'asc' };
  userSort: { key: 'userId' | 'name' | 'email' | 'role' | 'status'; direction: 'asc' | 'desc' } = { key: 'userId', direction: 'asc' };
  private routedUserDetailId: number | null = null;

  // Overview analytics
  allEmergencies: any[] = [];
  allTreatments: any[] = [];
  admissionsLast7Days: Array<{ dateKey: string; label: string; count: number }> = [];
  recentActivity: Array<{ type: string; message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];

  // Toggle states for inline forms
  showAddFacility = false;
  showAddUser = false;
  showAdmitPatient = false;
  isSubmitting = false;
  isSavingFacility = false;
  isRegisteringAmbulance = false;
  isAdmittingPatient = false;

  // Observability command center
  systemHealthLoading = false;
  systemHealthLastUpdated: Date | null = null;
  systemServices: Array<{
    key: string;
    label: string;
    endpoint: string;
    probePath: string | null;
    status: 'UP' | 'DOWN' | 'UNKNOWN';
    responseMs: number | null;
    details?: string;
  }> = [
    { key: 'gateway', label: 'API Gateway', endpoint: '/actuator/health', probePath: 'http://localhost:9090/actuator/health', status: 'UNKNOWN', responseMs: null },
    { key: 'auth', label: 'Auth Service', endpoint: '/admin/users', probePath: 'http://localhost:9090/admin/users', status: 'UNKNOWN', responseMs: null },
    { key: 'citizen', label: 'Citizen Service', endpoint: '/api/citizens', probePath: 'http://localhost:9090/api/citizens', status: 'UNKNOWN', responseMs: null },
    { key: 'emergency', label: 'Emergency Service', endpoint: '/emergencies', probePath: 'http://localhost:9090/emergencies', status: 'UNKNOWN', responseMs: null },
    { key: 'facility', label: 'Facility Service', endpoint: '/facilities', probePath: 'http://localhost:9090/facilities', status: 'UNKNOWN', responseMs: null },
    { key: 'patient', label: 'Patient/Treatment Service', endpoint: '/patients', probePath: 'http://localhost:9090/patients', status: 'UNKNOWN', responseMs: null },
    { key: 'compliance', label: 'Compliance Service', endpoint: '/compliance/logs', probePath: 'http://localhost:9090/compliance/logs', status: 'UNKNOWN', responseMs: null },
    { key: 'notification', label: 'Notification Service', endpoint: '/notifications/user/{userId}', probePath: 'http://localhost:9090/notifications/user/{userId}', status: 'UNKNOWN', responseMs: null },
    { key: 'registry', label: 'Service Registry', endpoint: 'Inferred via Gateway discovery', probePath: null, status: 'UNKNOWN', responseMs: null },
  ];

  // Expose enums to template
  FacilityStatus = FacilityStatus;
  FacilityType = FacilityType;

  facilityForm!: FormGroup;
  editFacilityForm!: FormGroup;
  userForm!: FormGroup;
  ambulanceForm!: FormGroup;
  admitForm = { citizenId: 0, emergencyId: 0, facilityId: 0, ward: '', notes: '' };

  private get headers() {
    return new HttpHeaders({
      Authorization: `Bearer ${this.auth.getToken()}`
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
      role: ['', Validators.required],
      facilityId: [null]
    });
    this.userForm.get('role')?.valueChanges.subscribe(role => {
      this.updateFacilityRequirement(role);
    });
    this.updateFacilityRequirement(this.userForm.get('role')?.value);
    this.ambulanceForm = this.fb.group({
      vehicleNumber: ['', [Validators.required, Validators.pattern(/^[A-Z]{2,4}-\d{2,4}$/), Validators.minLength(4), Validators.maxLength(10)]],
      model: ['', Validators.maxLength(50)],
      facilityId: [null, Validators.required]
    });
  }

  private isFacilityRequiredRole(role: string | null | undefined): boolean {
    return role === 'DOCTOR' || role === 'NURSE' || role === 'DISPATCHER';
  }

  private updateFacilityRequirement(role: string | null | undefined): void {
    const facilityControl = this.userForm.get('facilityId');
    if (!facilityControl) return;

    if (this.isFacilityRequiredRole(role)) {
      facilityControl.setValidators([Validators.required]);
    } else {
      facilityControl.clearValidators();
      facilityControl.setValue(null);
    }

    facilityControl.updateValueAndValidity({ emitEvent: false });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.handleTabChange(this.activeTab);
      }

      const userIdParam = params['userId'];
      if (this.activeTab === 'userDetail' && userIdParam) {
        const userId = Number(userIdParam);
        if (!Number.isNaN(userId) && userId > 0 && this.routedUserDetailId !== userId) {
          this.routedUserDetailId = userId;
          this.openUserDetailsById(userId);
        }
      } else if (!userIdParam) {
        this.routedUserDetailId = null;
      }
    });

    this.loadFacilities();
    this.loadUsers();
    this.loadPatients();
    this.loadAmbulances();
    this.loadPendingVerifications();
    this.loadDispatchedEmergencies();
    this.loadNotifications();
    this.loadEmergencies();
    this.loadTreatments();
    this.startPendingVerificationAutoSync();

    this.verificationService.pendingCitizens$.subscribe(citizens => {
      this.pendingDocuments = citizens;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.pendingVerificationRefreshTimer) {
      clearTimeout(this.pendingVerificationRefreshTimer);
      this.pendingVerificationRefreshTimer = null;
    }

    if (this.pendingVerificationAutoSyncInterval) {
      clearInterval(this.pendingVerificationAutoSyncInterval);
      this.pendingVerificationAutoSyncInterval = null;
    }
  }

  private startPendingVerificationAutoSync() {
    if (this.pendingVerificationAutoSyncInterval) {
      clearInterval(this.pendingVerificationAutoSyncInterval);
    }

    this.pendingVerificationAutoSyncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      this.schedulePendingVerificationRefresh();
    }, 4000);
  }

  private schedulePendingVerificationRefresh() {
    if (this.pendingVerificationRefreshTimer) {
      clearTimeout(this.pendingVerificationRefreshTimer);
    }

    this.pendingVerificationRefreshTimer = setTimeout(() => {
      this.verificationService.refreshVerifications();
      this.pendingVerificationRefreshTimer = null;
    }, 500);
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
    if (tab === 'notifications') this.loadNotifications();
    if (tab === 'patientsManagement') this.loadPatients();
    if (tab === 'admitPatient') this.loadDispatchedEmergencies();
    if (tab === 'pendingDocs') this.loadPendingVerifications();
    if (tab === 'systemHealth') this.loadSystemHealth();
  }

  loadFacilities() {
    this.facilityService.getAllFacilities().subscribe({
      next: d => {
        this.facilities = d;
        this.selectedFacilityIds.clear();
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
    this.applyFacilitySort();
  }

  sortFacilitiesBy(column: 'facilityId' | 'name' | 'type' | 'location' | 'capacity' | 'status') {
    if (this.facilitySort.key === column) {
      this.facilitySort.direction = this.facilitySort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.facilitySort = { key: column, direction: 'asc' };
    }
    this.applyFacilitySort();
  }

  private applyFacilitySort() {
    const { key, direction } = this.facilitySort;
    const dir = direction === 'asc' ? 1 : -1;

    this.filteredFacilities = [...this.filteredFacilities].sort((a, b) => {
      const aValue = (a as any)?.[key];
      const bValue = (b as any)?.[key];
      return this.compareGridValues(aValue, bValue) * dir;
    });
  }

  get areAllVisibleFacilitiesSelected() {
    return this.filteredFacilities.length > 0 &&
      this.filteredFacilities.every(f => this.selectedFacilityIds.has(f.facilityId));
  }

  get hasSelectedFacilities() {
    return this.selectedFacilityIds.size > 0;
  }

  toggleFacilitySelection(facilityId: number, checked: boolean) {
    if (checked) {
      this.selectedFacilityIds.add(facilityId);
    } else {
      this.selectedFacilityIds.delete(facilityId);
    }
  }

  toggleSelectAllVisibleFacilities(checked: boolean) {
    if (checked) {
      this.filteredFacilities.forEach(f => this.selectedFacilityIds.add(f.facilityId));
      return;
    }
    this.filteredFacilities.forEach(f => this.selectedFacilityIds.delete(f.facilityId));
  }

  clearFacilitySelection() {
    this.selectedFacilityIds.clear();
  }

  bulkUpdateSelectedFacilities(status: FacilityStatus) {
    const actionKey = this.bulkFacilityActionKey(status);
    if (!this.beginAction(actionKey)) return;

    const selectedIds = Array.from(this.selectedFacilityIds)
      .filter(id => {
        const facility = this.facilities.find(f => f.facilityId === id);
        return !!facility && facility.status !== status;
      });

    if (selectedIds.length === 0) {
      this.toastService.showWarning('No selected facilities need this status change');
      this.endAction(actionKey);
      return;
    }

    forkJoin(selectedIds.map(id => this.facilityService.updateFacilityStatus(id, status)))
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {
          this.toastService.showSuccess(`${selectedIds.length} facility(s) updated to ${status}`);
          this.selectedFacilityIds.clear();
          this.loadFacilities();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to apply bulk facility status update'));
          this.loadFacilities();
        }
      });
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
    const actionKey = 'facility-edit-submit';
    if (!this.beginAction(actionKey)) return;
    if (this.editFacilityForm.invalid) {
      this.editFacilityForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      this.endAction(actionKey);
      return;
    }

    this.isSavingFacility = true;
    this.facilityService.updateFacility(this.selectedFacility.facilityId, this.editFacilityForm.value)
      .pipe(finalize(() => {
        this.isSavingFacility = false;
        this.endAction(actionKey);
      }))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Facility updated successfully');
          this.loadFacilities();
          this.cancelEditFacility();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to update facility'));
        }
      });
  }

  updateFacilityStatus(facilityId: number, newStatus: FacilityStatus) {
    const actionKey = this.facilityStatusActionKey(facilityId, newStatus);
    if (!this.beginAction(actionKey)) return;

    this.facilityService.updateFacilityStatus(facilityId, newStatus)
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Facility status updated successfully');
          this.loadFacilities();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to update facility status'));
        }
      });
  }

  loadUsers() {
    this.adminService.getAllUsers().subscribe({
      next: d => {
        console.log('Users loaded:', d);
        this.users = d;
        this.selectedUserIds.clear();
        this.applyUserSort();
        this.refreshOverviewInsights();
      },
      error: e => {
        this.toastService.showError('Failed to load users: ' + (e.error?.message || e.message));
      }
    });
  }

  sortUsersBy(column: 'userId' | 'name' | 'email' | 'role' | 'status') {
    if (this.userSort.key === column) {
      this.userSort.direction = this.userSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.userSort = { key: column, direction: 'asc' };
    }
    this.applyUserSort();
  }

  private applyUserSort() {
    const { key, direction } = this.userSort;
    const dir = direction === 'asc' ? 1 : -1;

    this.users = [...this.users].sort((a, b) => {
      const aValue = key === 'status' ? (a.status || 'ACTIVE') : ((a as any)?.[key]);
      const bValue = key === 'status' ? (b.status || 'ACTIVE') : ((b as any)?.[key]);
      return this.compareGridValues(aValue, bValue) * dir;
    });
  }

  get areAllUsersSelected() {
    return this.users.length > 0 && this.users.every(u => this.selectedUserIds.has(u.userId || u.id));
  }

  get hasSelectedUsers() {
    return this.selectedUserIds.size > 0;
  }

  toggleUserSelection(userId: number, checked: boolean) {
    if (checked) {
      this.selectedUserIds.add(userId);
    } else {
      this.selectedUserIds.delete(userId);
    }
  }

  toggleSelectAllUsers(checked: boolean) {
    if (checked) {
      this.users.forEach(u => this.selectedUserIds.add(u.userId || u.id));
      return;
    }
    this.selectedUserIds.clear();
  }

  clearUserSelection() {
    this.selectedUserIds.clear();
  }

  bulkDeactivateSelectedUsers() {
    const actionKey = this.bulkUserActionKey('deactivate');
    if (!this.beginAction(actionKey)) return;

    const currentUserId = this.auth.getUser()?.userId || this.auth.getUser()?.id;
    const targetIds = Array.from(this.selectedUserIds)
      .filter(id => id !== currentUserId)
      .filter(id => {
        const user = this.users.find(u => (u.userId || u.id) === id);
        return !!user && (user.status || 'ACTIVE') !== 'INACTIVE';
      });

    if (targetIds.length === 0) {
      this.toastService.showWarning('No selected users can be deactivated');
      this.endAction(actionKey);
      return;
    }

    forkJoin(targetIds.map(id => this.adminService.deactivateUser(id)))
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {
          this.toastService.showSuccess(`${targetIds.length} user(s) deactivated`);
          this.selectedUserIds.clear();
          this.loadUsers();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to deactivate selected users'));
          this.loadUsers();
        }
      });
  }

  bulkActivateSelectedUsers() {
    const actionKey = this.bulkUserActionKey('activate');
    if (!this.beginAction(actionKey)) return;

    const targetIds = Array.from(this.selectedUserIds).filter(id => {
      const user = this.users.find(u => (u.userId || u.id) === id);
      return !!user && (user.status || 'ACTIVE') !== 'ACTIVE';
    });

    if (targetIds.length === 0) {
      this.toastService.showWarning('No selected users can be activated');
      this.endAction(actionKey);
      return;
    }

    forkJoin(targetIds.map(id => this.adminService.activateUser(id)))
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {
          this.toastService.showSuccess(`${targetIds.length} user(s) activated`);
          this.selectedUserIds.clear();
          this.loadUsers();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to activate selected users'));
          this.loadUsers();
        }
      });
  }

  getSortDirection(column: string): 'asc' | 'desc' | null {
    if (this.userSort.key === column) return this.userSort.direction;
    if (this.facilitySort.key === column) return this.facilitySort.direction;
    return null;
  }

  private compareGridValues(aValue: any, bValue: any): number {
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return -1;
    if (bValue == null) return 1;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return aValue - bValue;
    }

    return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' });
  }

  loadPatients() {
    this.http.get<any>('http://localhost:9090/patients', { headers: this.headers })
      .subscribe({
        next: d => {
          this.patients = d?.data ?? d;
          // Collect unique citizenIds that aren't cached yet
          const uncachedCitizenIds = [...new Set(this.patients.map(p => p.citizenId))]
            .filter(id => !this.citizenNameCache.has(id));
          // Apply cached names immediately (no jitter for already-known citizens)
          this.patients.forEach(p => {
            const cached = this.citizenNameCache.get(p.citizenId);
            if (cached) p.name = cached;
          });
          // Fetch only uncached citizen names
          uncachedCitizenIds.forEach(id => {
            this.citizenService.getCitizenById(id).subscribe({
              next: citizen => {
                this.citizenNameCache.set(id, citizen.name);
                this.patients.filter(p => p.citizenId === id).forEach(p => p.name = citizen.name);
                this.cdr.detectChanges();
              },
              error: () => {
                this.citizenNameCache.set(id, 'Unknown Citizen');
                this.patients.filter(p => p.citizenId === id).forEach(p => p.name = 'Unknown Citizen');
                this.cdr.detectChanges();
              }
            });
          });
          // Load assigned doctors (only if not already cached)
          this.patients.forEach(p => {
            if (!this.patientDoctorMap.has(p.patientId)) {
              this.loadAssignedDoctor(p.patientId);
            }
          });
          this.refreshOverviewInsights();
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  loadEmergencies() {
    this.http.get<any>('http://localhost:9090/emergencies', { headers: this.headers })
      .subscribe({
        next: d => {
          this.allEmergencies = d?.data ?? d ?? [];
          this.refreshOverviewInsights();
          this.cdr.detectChanges();
        },
        error: () => {
          this.allEmergencies = [];
          this.refreshOverviewInsights();
        }
      });
  }

  loadTreatments() {
    this.http.get<any>('http://localhost:9090/treatments', { headers: this.headers })
      .subscribe({
        next: d => {
          this.allTreatments = d?.data ?? d ?? [];
          this.refreshOverviewInsights();
          this.cdr.detectChanges();
        },
        error: () => {
          this.allTreatments = [];
          this.refreshOverviewInsights();
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

    const actionKey = this.patientDischargeActionKey(patientId);
    if (!this.beginAction(actionKey)) return;

    this.http.patch<any>(`http://localhost:9090/patients/${patientId}/status?status=DISCHARGED`, {}, { headers: this.headers })
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Patient discharged successfully');
          this.loadPatients();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to discharge patient'));
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
                this.refreshOverviewInsights();
                this.cdr.markForCheck();
              },
              error: () => {
                this.dispatchedEmergencies = allDispatched;
                this.dispatchedEmergencies.forEach(e => this.loadCitizenNameForEmergency(e));
                this.refreshOverviewInsights();
                this.cdr.markForCheck();
              }
            });
        },
        error: () => {}
      });
  }

  addFacility() {
    if (this.isSavingFacility) return;
    const actionKey = 'facility-add';
    if (!this.beginAction(actionKey)) return;
    if (this.facilityForm.invalid) {
      this.facilityForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      this.endAction(actionKey);
      return;
    }
    this.isSavingFacility = true;
    this.facilityService.createFacility(this.facilityForm.value)
      .pipe(finalize(() => {
        this.isSavingFacility = false;
        this.endAction(actionKey);
      }))
      .subscribe({
        next: () => {
          this.facilityForm.reset({ name: '', type: FacilityType.HOSPITAL, location: '', capacity: 0, status: FacilityStatus.ACTIVE });
          this.showAddFacility = false;
          this.toastService.showSuccess('Facility added successfully');
          this.loadFacilities();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to add facility'));
        }
      });
  }

  toggleAddFacility() {
    this.showAddFacility = !this.showAddFacility;
  }

  addUser() {
    const actionKey = 'user-add';
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }
    if (this.isSubmitting) return;
    if (!this.beginAction(actionKey)) return;
    this.isSubmitting = true;

    const formValue = this.userForm.value;
    if (!formValue.role) {
      this.toastService.showError('Please select a role');
      this.isSubmitting = false;
      this.endAction(actionKey);
      return;
    }

    const basePayload: CreateUserRequest = {
      name: formValue.name,
      email: formValue.email,
      password: formValue.password,
      phone: formValue.phone,
      role: formValue.role
    };

    let observable;
    switch (formValue.role) {
      case 'DOCTOR':
      case 'NURSE':
      case 'DISPATCHER':
        if (!formValue.facilityId) {
          this.toastService.showError('Please select a facility for this role');
          this.isSubmitting = false;
          this.endAction(actionKey);
          return;
        }
        const staffPayload: CreateStaffRequest = {
          ...basePayload,
          facilityId: Number(formValue.facilityId)
        };
        observable = this.adminService.createStaffViaFacility(staffPayload);
        break;
      case 'COMPLIANCE_OFFICER':
        observable = this.adminService.createComplianceOfficer(basePayload);
        break;
      default:
        this.toastService.showError('Invalid role selected');
        this.isSubmitting = false;
        this.endAction(actionKey);
        return;
    }

    observable
      .pipe(finalize(() => {
        this.isSubmitting = false;
        this.endAction(actionKey);
      }))
      .subscribe({
        next: () => {
          this.userForm.reset({ name: '', email: '', password: '', phone: '', role: '', facilityId: null });
          this.updateFacilityRequirement('');
          this.showAddUser = false;
          this.toastService.showSuccess('User created successfully');
          this.loadUsers();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to add user'));
        }
      });
  }

  toggleAddUser() {
    this.showAddUser = !this.showAddUser;
    if (this.showAddUser) {
      this.userForm.reset({ name: '', email: '', password: '', phone: '', role: '', facilityId: null });
      this.updateFacilityRequirement('');
    }
  }

  registerAmbulance() {
    if (this.isRegisteringAmbulance) return;
    const actionKey = 'ambulance-register';
    if (!this.beginAction(actionKey)) return;
    if (this.ambulanceForm.invalid) {
      this.ambulanceForm.markAllAsTouched();
      this.toastService.showError('Vehicle number is required');
      this.endAction(actionKey);
      return;
    }
    this.isRegisteringAmbulance = true;
    this.http.post<any>('http://localhost:9090/emergencies/admin/ambulances', this.ambulanceForm.value, { headers: this.headers })
      .pipe(finalize(() => {
        this.isRegisteringAmbulance = false;
        this.endAction(actionKey);
      }))
      .subscribe({
        next: () => {
          this.ambulanceForm.reset({ vehicleNumber: '', model: '', facilityId: null });
          this.toastService.showSuccess('Ambulance registered successfully');
          this.loadAmbulances();
        },
        error: (err) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to register ambulance'));
        }
      });
  }

  updateAmbulanceStatus(id: number, status: string) {
    const actionKey = this.ambulanceStatusActionKey(id, status);
    if (!this.beginAction(actionKey)) return;

    this.ambulanceService.updateAmbulanceStatus(id, status)
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Ambulance status updated');
          this.loadAmbulances();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to update ambulance status'));
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

    const actionKey = this.ambulanceRemoveActionKey(ambulance.ambulanceId);
    if (!this.beginAction(actionKey)) return;

    this.ambulanceService.deleteAmbulance(ambulance.ambulanceId)
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Ambulance removed successfully');
          this.loadAmbulances();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to remove ambulance'));
        }
      });
  }

  getFacilityName(facilityId: number): string {
    const facility = this.facilities.find(f => f.facilityId === facilityId);
    return facility ? facility.name : `Facility #${facilityId}`;
  }

  admitPatient() {
    if (this.isAdmittingPatient) return;
    const actionKey = 'patient-admit';
    if (!this.beginAction(actionKey)) return;
    const payload = {
      citizenId: this.admitForm.citizenId,
      emergencyId: this.admitForm.emergencyId,
      facilityId: this.admitForm.facilityId,
      ward: this.admitForm.ward,
      notes: this.admitForm.notes
    };
    this.isAdmittingPatient = true;
    this.http.post<any>('http://localhost:9090/patients/admit', payload, { headers: this.headers })
      .pipe(finalize(() => {
        this.isAdmittingPatient = false;
        this.endAction(actionKey);
      }))
      .subscribe({
        next: () => {
          this.admitForm = { citizenId: 0, emergencyId: 0, facilityId: 0, ward: '', notes: '' };
          this.showAdmitPatient = false;
          this.toastService.showSuccess('Patient admitted successfully');
          this.loadPatients();
          this.loadDispatchedEmergencies();
        },
        error: (err: any) => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to admit patient'));
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
    this.admitForm = { citizenId: 0, emergencyId: 0, facilityId: 0, ward: '', notes: '' };
  }

  prepareAdmit(emergency: any) {
    this.admitForm.citizenId = emergency.citizenId;
    this.admitForm.emergencyId = emergency.emergencyId;
    this.admitForm.facilityId = emergency.ambulance?.facilityId || 0;
    this.admitForm.ward = '';
    this.admitForm.notes = `Emergency: ${emergency.type} at ${emergency.location}`;
  }

  activateUser(userId: number) {
    const id = userId || (this.selectedUser?.userId ?? this.selectedUser?.id);
    const actionKey = this.userActionKey('activate', id!);
    if (!this.beginAction(actionKey)) return;

    this.adminService.activateUser(id!)
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
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
        error: (err: any) => this.toastService.showError(this.extractErrorMessage(err, 'Failed to activate user'))
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
    const actionKey = this.userActionKey('deactivate', id!);
    if (!this.beginAction(actionKey)) return;

    this.adminService.deactivateUser(id!)
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
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
        error: (err: any) => this.toastService.showError(this.extractErrorMessage(err, 'Failed to deactivate user'))
      });
  }

  async removeUser(userId: number) {
    const id = userId || (this.selectedUser?.userId ?? this.selectedUser?.id);
    const currentUserId = this.auth.getUser()?.userId || this.auth.getUser()?.id;

    if (!id) {
      this.toastService.showError('Invalid user selected');
      return;
    }

    if (id === currentUserId) {
      this.toastService.showError('You cannot remove your own account');
      return;
    }

    const targetUser = this.users.find(u => (u.userId || u.id) === id) || this.selectedUser;
    const role = targetUser?.role || '';
    const isStaffRole = role === 'DOCTOR' || role === 'NURSE' || role === 'DISPATCHER';

    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove User',
      message: 'This will permanently remove the user account. This action cannot be undone.',
      confirmText: 'Remove',
      type: 'warning'
    });
    if (!confirmed) return;

    const actionKey = this.userActionKey('remove', id);
    if (!this.beginAction(actionKey)) return;

    const finalizeUserRemoval = () => {
      this.users = this.users.filter(u => (u.userId || u.id) !== id);
      if ((this.selectedUser?.userId || this.selectedUser?.id) === id) {
        this.selectedUser = null;
        this.userExtraDetails = null;
        this.userDocuments = [];
        this.userDocPreviewUrl = null;
        this.setTab('users');
      }
      this.toastService.showSuccess('User removed successfully');
      this.cdr.markForCheck();
    };

    const deleteAuthUser = () => {
      this.adminService.deleteUser(id)
        .pipe(finalize(() => this.endAction(actionKey)))
        .subscribe({
          next: () => finalizeUserRemoval(),
          error: (err: any) => {
            if (err?.status === 404) {
              finalizeUserRemoval();
              return;
            }
            this.toastService.showError(this.extractErrorMessage(err, 'Failed to remove user'));
          }
        });
    };

    if (!isStaffRole) {
      deleteAuthUser();
      return;
    }

    this.adminService.deleteStaffRecord(id).subscribe({
      next: () => deleteAuthUser(),
      error: (err: any) => {
        if (err?.status === 404) {
          deleteAuthUser();
          return;
        }
        this.toastService.showError(this.extractErrorMessage(err, 'Failed to remove staff record'));
        this.endAction(actionKey);
      }
    });
  }

  viewUserDetails(user: User) {
    this.selectedUser = user;
    this.userExtraDetails = null;
    this.userDocuments = [];
    this.userDocPreviewUrl = null;
    this.isLoadingUserDoc = false;
    this.userCitizenId = null;
    this.setTab('userDetail');

    const userId = user.userId || user.id;
    this.loadRoleSpecificDetails(user.role, userId);
  }

  private openUserDetailsById(userId: number) {
    const existingUser = this.users.find(u => (u.userId || u.id) === userId);
    if (existingUser) {
      this.viewUserDetails(existingUser);
      return;
    }

    this.adminService.getUserById(userId).subscribe({
      next: user => {
        const normalized: User = { ...user, userId: user.userId || user.id, id: user.id || user.userId };
        const alreadyInList = this.users.some(u => (u.userId || u.id) === normalized.userId);
        if (!alreadyInList) {
          this.users = [normalized, ...this.users];
          this.applyUserSort();
        }
        this.viewUserDetails(normalized);
      },
      error: () => {
        this.toastService.showError(`Unable to open user #${userId}`);
        this.setTab('users');
      }
    });
  }

  private loadRoleSpecificDetails(role: string, userId: number) {
    switch (role) {
      case 'CITIZEN':
        // citizenId == userId in this system
        this.http.get<any>(`http://localhost:9090/api/citizens/${userId}`, { headers: this.headers })
          .subscribe({
            next: res => {
              const citizen = res?.data ?? res;
              if (citizen && citizen.citizenId) {
                this.userExtraDetails = citizen;
                this.userCitizenId = citizen.citizenId;
                this.cdr.detectChanges();
                // Load documents
                this.http.get<any>(`http://localhost:9090/api/citizens/${citizen.citizenId}/documents`, { headers: this.headers })
                  .subscribe({
                    next: docRes => { this.userDocuments = docRes?.data ?? docRes; this.cdr.detectChanges(); },
                    error: () => this.userDocuments = []
                  });
              } else {
                this.fallbackToUserTable(userId);
              }
            },
            error: () => this.fallbackToUserTable(userId)
          });
        break;

      case 'DOCTOR':
      case 'NURSE':
      case 'DISPATCHER':
        // staffId == userId in this system
        this.http.get<any>(`http://localhost:9090/staff/${userId}`, { headers: this.headers })
          .subscribe({
            next: res => {
              const staff = res?.data ?? res;
              if (staff && (staff.staffId || staff.name)) {
                this.userExtraDetails = staff;
              } else {
                this.fallbackToUserTable(userId);
              }
              this.cdr.detectChanges();
            },
            error: () => this.fallbackToUserTable(userId)
          });
        break;

      case 'COMPLIANCE_OFFICER':
      case 'ADMIN':
      default:
        this.fallbackToUserTable(userId);
        break;
    }
  }

  private fallbackToUserTable(userId: number) {
    this.adminService.getUserById(userId).subscribe({
      next: user => {
        this.userExtraDetails = user;
        this.cdr.detectChanges();
      },
      error: () => {
        this.userExtraDetails = null;
        this.cdr.detectChanges();
      }
    });
  }

  previewUserDocument(doc: any) {
    if (!this.selectedUser || !this.userCitizenId) return;
    this.isLoadingUserDoc = true;
    this.userDocPreviewUrl = null;
    this.userDocIsImage = false;
    this.previewingUserDocId = doc.documentId;
    this.cdr.detectChanges();

    this.citizenService.getDocumentBlob(this.userCitizenId, doc.documentId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        this.userDocIsImage = blob.type.startsWith('image/');
        this.userDocPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.isLoadingUserDoc = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastService.showError('Failed to load document');
        this.isLoadingUserDoc = false;
        this.cdr.detectChanges();
      }
    });
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

    const actionKey = this.documentVerificationActionKey(docId, status);
    if (!this.beginAction(actionKey)) return;

    this.citizenService.verifyDocument(docId, status)
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => {
          this.toastService.showSuccess(`Document ${status.toLowerCase()} successfully`);
          this.citizenDocuments = this.citizenDocuments.map(d =>
            d.documentId === docId ? { ...d, verificationStatus: status } : d
          );
          this.verificationService.refreshVerifications();
        },
        error: (err: any) => this.toastService.showError(this.extractErrorMessage(err, 'Failed to verify document'))
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
    this.previewingDocId = doc.documentId;
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

  closePreview() {
    this.documentPreviewUrl = null;
    this.documentIsImage = false;
    this.previewingDocId = null;
    this.selectedDocument$.next(null);
    this.cdr.markForCheck();
  }

  trackByUserId(index: number, user: User): number {
    return user.userId || user.id;
  }

  loadNotifications() {
    this.notificationService.getMyNotifications().subscribe({
      next: d => {
        const hasNewNotifications = d.some(n => !this.seenNotificationIds.has(n.notificationId));

        if (hasNewNotifications) {
          this.schedulePendingVerificationRefresh();
        }

        this.seenNotificationIds = new Set(d.map(n => n.notificationId));
        this.notifications = d;
        this.unreadCount = d.filter(n => n.status === 'UNREAD').length;
        this.refreshOverviewInsights();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private refreshOverviewInsights() {
    this.buildAdmissionsLast7Days();
    this.buildRecentActivity();
  }

  private buildAdmissionsLast7Days() {
    const buckets: Array<{ dateKey: string; label: string; count: number }> = [];
    const now = new Date();

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
      const dt = this.tryParseDate((p as any).admissionDate);
      if (!dt) return;
      const key = this.toDateKey(dt);
      const bucket = map.get(key);
      if (bucket) bucket.count += 1;
    });

    this.admissionsLast7Days = buckets;
  }

  private buildRecentActivity() {
    const events: Array<{ type: string; message: string; timestamp: Date; severity: 'info' | 'warning' | 'success' }> = [];

    this.allEmergencies.forEach(e => {
      const reportedAt = this.tryParseDate(e?.reportedAt ?? e?.date);
      if (reportedAt) {
        events.push({
          type: 'EMERGENCY_REPORTED',
          message: `Emergency #${e.emergencyId} reported (${e.type ?? 'UNKNOWN'})`,
          timestamp: reportedAt,
          severity: 'warning',
        });
      }

      const dispatchedAt = this.tryParseDate(e?.dispatchedAt);
      if (dispatchedAt) {
        events.push({
          type: 'DISPATCHED',
          message: `Emergency #${e.emergencyId} dispatched`,
          timestamp: dispatchedAt,
          severity: 'success',
        });
      }
    });

    this.patients.forEach(p => {
      const admitted = this.tryParseDate((p as any).admissionDate);
      if (admitted) {
        events.push({
          type: 'PATIENT_ADMITTED',
          message: `Patient #${p.patientId} admitted${p.ward ? ` (${p.ward})` : ''}`,
          timestamp: admitted,
          severity: 'success',
        });
      }

      const discharged = this.tryParseDate((p as any).dischargeDate);
      if (discharged) {
        events.push({
          type: 'PATIENT_DISCHARGED',
          message: `Patient #${p.patientId} discharged`,
          timestamp: discharged,
          severity: 'info',
        });
      }
    });

    this.allTreatments.forEach(t => {
      const changedAt = this.tryParseDate(t?.date ?? t?.startDate ?? t?.endDate);
      if (!changedAt) return;
      events.push({
        type: 'TREATMENT_UPDATED',
        message: `Treatment #${t.treatmentId} ${String(t.status ?? 'updated').toLowerCase()}`,
        timestamp: changedAt,
        severity: t?.status === 'COMPLETED' ? 'success' : 'info',
      });
    });

    this.notifications.forEach(n => {
      const ts = this.tryParseDate(n.createdDate);
      if (!ts) return;
      events.push({
        type: 'NOTIFICATION',
        message: n.message,
        timestamp: ts,
        severity: n.status === 'UNREAD' ? 'warning' : 'info',
      });
    });

    this.users.forEach(u => {
      const created = this.tryParseDate((u as any).createdAt ?? (u as any).createdDate ?? (u as any).registeredAt);
      if (!created) return;
      events.push({
        type: 'USER_REGISTERED',
        message: `${u.role} account created for ${u.name}`,
        timestamp: created,
        severity: 'info',
      });
    });

    this.recentActivity = events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 18);
  }

  getAdmissionBarHeight(count: number): number {
    const max = Math.max(...this.admissionsLast7Days.map(x => x.count), 1);
    return Math.max((count / max) * 100, count > 0 ? 12 : 4);
  }

  formatActivityTime(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();
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
    const actionKey = `notification-read:${id}`;
    if (!this.beginAction(actionKey)) return;

    this.notificationService.markAsRead(id)
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => this.loadNotifications(),
        error: () => {}
      });
  }

  markAllRead() {
    const actionKey = 'notifications-read-all';
    if (!this.beginAction(actionKey)) return;

    this.notificationService.markAllAsRead()
      .pipe(finalize(() => this.endAction(actionKey)))
      .subscribe({
        next: () => this.loadNotifications(),
        error: () => {}
      });
  }

  isActionInFlight(actionKey: string): boolean {
    return this.actionInFlight.has(actionKey);
  }

  facilityStatusActionKey(facilityId: number, status: FacilityStatus): string {
    return `facility-status:${facilityId}:${status}`;
  }

  bulkFacilityActionKey(status: FacilityStatus): string {
    return `bulk-facility-status:${status}`;
  }

  userActionKey(action: 'activate' | 'deactivate' | 'remove', userId: number): string {
    return `user:${action}:${userId}`;
  }

  bulkUserActionKey(action: 'activate' | 'deactivate'): string {
    return `bulk-user:${action}`;
  }

  ambulanceStatusActionKey(ambulanceId: number, status: string): string {
    return `ambulance-status:${ambulanceId}:${status}`;
  }

  ambulanceRemoveActionKey(ambulanceId: number): string {
    return `ambulance-remove:${ambulanceId}`;
  }

  documentVerificationActionKey(docId: number, status: 'VERIFIED' | 'REJECTED'): string {
    return `document-verify:${docId}:${status}`;
  }

  patientDischargeActionKey(patientId: number): string {
    return `patient-discharge:${patientId}`;
  }

  private beginAction(actionKey: string): boolean {
    if (this.actionInFlight.has(actionKey)) {
      return false;
    }
    this.actionInFlight.add(actionKey);
    return true;
  }

  private endAction(actionKey: string): void {
    this.actionInFlight.delete(actionKey);
  }

  private extractErrorMessage(err: any, fallback: string): string {
    return err?.error?.message || err?.message || fallback;
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

  loadSystemHealth() {
    if (this.systemHealthLoading) return;

    this.systemHealthLoading = true;
    const currentUserId = this.auth.getUser()?.userId || this.auth.getUser()?.id;

    const requests = this.systemServices.map(service => {
      if (!service.probePath) {
        return of({
          key: service.key,
          status: 'UNKNOWN' as const,
          responseMs: null,
          details: 'Derived from gateway discovery status',
        });
      }

      const probeUrl = service.probePath.replace('{userId}', String(currentUserId ?? '0'));
      const startedAt = performance.now();
      return this.http.get<any>(probeUrl, {
        headers: this.headers,
        observe: 'response'
      }).pipe(
        map(res => {
          const bodyStatus = String((res as any)?.body?.status ?? '').toUpperCase();
          const isUp = (res as any)?.status >= 200 && (res as any)?.status < 300 && bodyStatus !== 'DOWN';
          return {
            key: service.key,
            status: isUp ? 'UP' as const : 'DOWN' as const,
            responseMs: Math.round(performance.now() - startedAt),
            details: bodyStatus || `HTTP ${(res as any)?.status}`,
          };
        }),
        catchError((err) => {
          const httpStatus = err?.status as number | undefined;
          const isAuthRestricted = httpStatus === 401 || httpStatus === 403;
          return of({
            key: service.key,
            status: isAuthRestricted ? 'UNKNOWN' as const : 'DOWN' as const,
            responseMs: Math.round(performance.now() - startedAt),
            details: httpStatus
              ? (isAuthRestricted ? `HTTP ${httpStatus} (Access restricted)` : `HTTP ${httpStatus}`)
              : 'Unavailable',
          });
        })
      );
    });

    forkJoin(requests).subscribe({
      next: results => {
        const resultMap = new Map(results.map(r => [r.key, r]));
        this.systemServices = this.systemServices.map(service => {
          const result = resultMap.get(service.key);
          if (!result) return service;

          if (service.key === 'registry') {
            const gateway = resultMap.get('gateway');
            if (gateway?.status === 'UP') {
              return {
                ...service,
                status: 'UP' as const,
                responseMs: gateway.responseMs,
                details: 'Gateway discovery active',
              };
            }
            return {
              ...service,
              status: 'UNKNOWN' as const,
              responseMs: null,
              details: 'Unable to infer discovery status',
            };
          }

          return {
            ...service,
            status: result.status,
            responseMs: result.responseMs,
            details: result.details,
          };
        });
        this.systemHealthLastUpdated = new Date();
        this.systemHealthLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.systemHealthLoading = false;
        this.toastService.showError('Failed to load system health');
      }
    });
  }

  get upServicesCount() {
    return this.systemServices.filter(s => s.status === 'UP').length;
  }

  get downServicesCount() {
    return this.systemServices.filter(s => s.status === 'DOWN').length;
  }

  get averageResponseMs() {
    const samples = this.systemServices.map(s => s.responseMs).filter((v): v is number => typeof v === 'number');
    if (samples.length === 0) return 0;
    return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  }
}
