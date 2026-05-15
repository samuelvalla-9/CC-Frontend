import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { AuthService } from '../services/auth.service';
import { CitizenService } from '../services/citizen.service';
import { NotificationService } from '../services/notification.service';
import { VerificationService, PendingCitizen } from '../services/verification.service';
import { Patient } from '../../models/patient.model';
import { Notification } from '../../models/notification.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { ConfirmDialogService } from '../shared/confirm-dialog';
import { environment } from '../../environments/environment';
import { AdminFacilitiesTab } from './tabs/admin-facilities-tab';
import { AdminUsersTab } from './tabs/admin-users-tab';
import { AdminUserDetailTab } from './tabs/admin-user-detail-tab';
import { AdminPatientsManagementTab } from './tabs/admin-patients-management-tab';
import { AdminPatientDetailTab } from './tabs/admin-patient-detail-tab';
import { AdminPendingDocsTab } from './tabs/admin-pending-docs-tab';
import { AdminVerifyDocumentsTab } from './tabs/admin-verify-documents-tab';
import { AdminAmbulancesTab } from './tabs/admin-ambulances-tab';
import { AdminSystemHealthTab } from './tabs/admin-system-health-tab';
import { AdminNotificationsTab } from './tabs/admin-notifications-tab';
import { AdminOverviewTab } from './tabs/admin-overview-tab';
import { AdminEditFacilityTab } from './tabs/admin-edit-facility-tab';
import { AdminFacilitiesFacade } from './facades/admin-facilities-facade.service';
import { AdminAmbulancesFacade } from './facades/admin-ambulances-facade.service';
import { AdminUsersFacade } from './facades/admin-users-facade.service';

@Component({
  selector: 'app-admin',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    Navbar,
    AdminFacilitiesTab,
    AdminUsersTab,
    AdminUserDetailTab,
    AdminPatientsManagementTab,
    AdminPatientDetailTab,
    AdminPendingDocsTab,
    AdminVerifyDocumentsTab,
    AdminAmbulancesTab,
    AdminSystemHealthTab,
    AdminNotificationsTab,
    AdminOverviewTab,
    AdminEditFacilityTab
  ],
  providers: [AdminFacilitiesFacade, AdminAmbulancesFacade, AdminUsersFacade],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminDashboard implements OnInit, OnDestroy {
  activeTab = 'overview';
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
  selectedPatient: Patient | null = null;
  patientCitizenDetails: any = null;
  patientEmergencyDetails: any = null;
  patientTreatments: any[] = [];
  errorMsg = '';

  // Enterprise grid state (sorting)
  private actionInFlight = new Set<string>();
  private routedUserDetailId: number | null = null;

  // Toggle states for inline forms
  showAdmitPatient = false;
  isAdmittingPatient = false;

  admitForm = { citizenId: 0, emergencyId: 0, facilityId: 0, ward: '', notes: '' };

  get users() {
    return this.usersFacade.users;
  }

  get selectedUser() {
    return this.usersFacade.selectedUser;
  }

  get facilities() {
    return this.facilitiesFacade.facilities;
  }

  get ambulances() {
    return this.ambulancesFacade.ambulances;
  }

  get selectedFacility() {
    return this.facilitiesFacade.selectedFacility;
  }

  getFacilityName(facilityId: number): string {
    return this.ambulancesFacade.getFacilityName(facilityId);
  }

  private get headers() {
    return new HttpHeaders({
      Authorization: `Bearer ${this.auth.getToken()}`
    });
  }

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private citizenService: CitizenService,
    private notificationService: NotificationService,
    private facilitiesFacade: AdminFacilitiesFacade,
    private ambulancesFacade: AdminAmbulancesFacade,
    private usersFacade: AdminUsersFacade,
    private verificationService: VerificationService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {
    this.pendingCount$ = this.verificationService.pendingCount$;
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
          this.usersFacade.openUserDetailsById(userId);
        }
      } else if (!userIdParam) {
        this.routedUserDetailId = null;
      }
    });

    this.facilitiesFacade.loadFacilities();
    this.usersFacade.loadUsers();
    this.loadPatients();
    this.ambulancesFacade.initialize();
    this.loadPendingVerifications();
    this.loadDispatchedEmergencies();
    this.loadNotifications();
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
  }

  loadPatients() {
    this.http.get<any>(`${environment.apiBaseUrl}/patients`, { headers: this.headers })
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
          this.cdr.detectChanges();
        },
        error: () => {}
      });
  }

  loadAssignedDoctor(patientId: number) {
    this.http.get<any>(`${environment.apiBaseUrl}/patients/${patientId}/treatments`, { headers: this.headers })
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
    this.http.get<any>(`${environment.apiBaseUrl}/staff/${doctorId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          const staff = d?.data ?? d;
          this.patientDoctorMap.set(patientId, staff.name);
          this.cdr.detectChanges();
        },
        error: () => {
          // Fallback to AuthService if staff record doesn't exist
          this.http.get<any>(`${environment.apiBaseUrl}/admin/users/${doctorId}`, { headers: this.headers })
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

    this.http.patch<any>(`${environment.apiBaseUrl}/patients/${patientId}/status?status=DISCHARGED`, {}, { headers: this.headers })
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

  loadDispatchedEmergencies() {
    this.http.get<any>(`${environment.apiBaseUrl}/emergencies/dispatched`, { headers: this.headers })
      .subscribe({
        next: d => {
          const allDispatched = d?.data ?? d;
          // Filter out emergencies that are already admitted by checking if patient exists
          this.http.get<any>(`${environment.apiBaseUrl}/patients`, { headers: this.headers })
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
    this.http.post<any>(`${environment.apiBaseUrl}/patients/admit`, payload, { headers: this.headers })
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

    this.http.get<any>(`${environment.apiBaseUrl}/api/citizens/${citizen.citizenId}/documents`, { headers: this.headers })
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

  loadNotifications() {
    this.notificationService.getMyUnreadCount().subscribe({
      next: count => {
        this.unreadCount = count;
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    this.notificationService.getMyNotifications().subscribe({
      next: d => {
        const hasNewNotifications = d.some(n => !this.seenNotificationIds.has(n.notificationId));

        if (hasNewNotifications) {
          this.schedulePendingVerificationRefresh();
        }

        this.seenNotificationIds = new Set(d.map(n => n.notificationId));
        this.notifications = d;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
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
    this.http.get<any>(`${environment.apiBaseUrl}/emergencies/${patient.emergencyId}`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.patientEmergencyDetails = d?.data ?? d;
          this.cdr.detectChanges();
        },
        error: () => {}
      });

    // Load treatments
    this.http.get<any>(`${environment.apiBaseUrl}/patients/${patient.patientId}/treatments`, { headers: this.headers })
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
