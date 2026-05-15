import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { AdminService, CreateStaffRequest, CreateUserRequest } from '../../services/admin.service';
import { CitizenService } from '../../services/citizen.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog';
import { User } from '../../../models/user.model';
import { AdminFacilitiesFacade } from './admin-facilities-facade.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class AdminUsersFacade {
  users: User[] = [];
  selectedUser: User | null = null;
  userExtraDetails: any = null;
  userDocuments: any[] = [];
  userDocPreviewUrl: SafeResourceUrl | null = null;
  previewingUserDocId: number | null = null;
  userDocIsImage = false;
  isLoadingUserDoc = false;
  showAddUser = false;
  isSubmitting = false;
  errorMsg = '';

  userSort: { key: 'userId' | 'name' | 'email' | 'role' | 'status'; direction: 'asc' | 'desc' } = {
    key: 'userId',
    direction: 'asc'
  };

  userForm: FormGroup;

  private userCitizenId: number | null = null;
  private readonly actionInFlight = new Set<string>();

  constructor(
    private readonly http: HttpClient,
    public auth: AuthService,
    private readonly adminService: AdminService,
    private readonly citizenService: CitizenService,
    private readonly toastService: ToastService,
    private readonly confirmDialog: ConfirmDialogService,
    private readonly sanitizer: DomSanitizer,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly facilitiesFacade: AdminFacilitiesFacade
  ) {
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
  }

  get facilities() {
    return this.facilitiesFacade.facilities;
  }

  loadUsers() {
    this.adminService.getAllUsers().subscribe({
      next: data => {
        this.users = data;
        this.applyUserSort();
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
        },
        error: err => {
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

  viewUserDetails(user: User) {
    this.selectedUser = user;
    this.userExtraDetails = null;
    this.userDocuments = [];
    this.userDocPreviewUrl = null;
    this.isLoadingUserDoc = false;
    this.userCitizenId = null;

    const userId = user.userId || user.id;
    this.setTab('userDetail', userId);
    this.loadRoleSpecificDetails(user.role, userId);
  }

  openUserDetailsById(userId: number) {
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
        this.setTab('users', null);
      }
    });
  }

  async activateUser(userId: number) {
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
        },
        error: err => this.toastService.showError(this.extractErrorMessage(err, 'Failed to activate user'))
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
        },
        error: err => this.toastService.showError(this.extractErrorMessage(err, 'Failed to deactivate user'))
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
    const isStaffRole = role === 'DOCTOR' || role === 'DISPATCHER';

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
        this.setTab('users', null);
      }
      this.toastService.showSuccess('User removed successfully');
    };

    const deleteAuthUser = () => {
      this.adminService.deleteUser(id)
        .pipe(finalize(() => this.endAction(actionKey)))
        .subscribe({
          next: () => finalizeUserRemoval(),
          error: err => {
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
      error: err => {
        if (err?.status === 404) {
          deleteAuthUser();
          return;
        }
        this.toastService.showError(this.extractErrorMessage(err, 'Failed to remove staff record'));
        this.endAction(actionKey);
      }
    });
  }

  previewUserDocument(doc: any) {
    if (!this.selectedUser || !this.userCitizenId) return;
    this.isLoadingUserDoc = true;
    this.userDocPreviewUrl = null;
    this.userDocIsImage = false;
    this.previewingUserDocId = doc.documentId;

    this.citizenService.getDocumentBlob(this.userCitizenId, doc.documentId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        this.userDocIsImage = blob.type.startsWith('image/');
        this.userDocPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.isLoadingUserDoc = false;
      },
      error: () => {
        this.toastService.showError('Failed to load document');
        this.isLoadingUserDoc = false;
      }
    });
  }

  trackByUserId(index: number, user: User): number {
    return user.userId || user.id;
  }

  getFacilityName(facilityId: number): string {
    const facility = this.facilities.find(f => f.facilityId === facilityId);
    return facility ? facility.name : `Facility #${facilityId}`;
  }

  isActionInFlight(actionKey: string): boolean {
    return this.actionInFlight.has(actionKey);
  }

  userActionKey(action: 'activate' | 'deactivate' | 'remove', userId: number): string {
    return `user:${action}:${userId}`;
  }

  setTab(tab: string, userId?: number | null) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab, userId: userId ?? null },
      queryParamsHandling: 'merge'
    });
  }

  private isFacilityRequiredRole(role: string | null | undefined): boolean {
    return role === 'DOCTOR' || role === 'DISPATCHER';
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

  private applyUserSort() {
    const { key, direction } = this.userSort;
    const dir = direction === 'asc' ? 1 : -1;

    this.users = [...this.users].sort((a, b) => {
      const aValue = key === 'status' ? (a.status || 'ACTIVE') : ((a as any)?.[key]);
      const bValue = key === 'status' ? (b.status || 'ACTIVE') : ((b as any)?.[key]);
      return this.compareGridValues(aValue, bValue) * dir;
    });
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

  private loadRoleSpecificDetails(role: string, userId: number) {
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });

    switch (role) {
      case 'CITIZEN':
        this.http.get<any>(`${environment.apiBaseUrl}/api/citizens/${userId}`, { headers })
          .subscribe({
            next: res => {
              const citizen = res?.data ?? res;
              if (citizen && citizen.citizenId) {
                this.userExtraDetails = citizen;
                this.userCitizenId = citizen.citizenId;
                this.http.get<any>(`${environment.apiBaseUrl}/api/citizens/${citizen.citizenId}/documents`, { headers })
                  .subscribe({
                    next: docRes => {
                      this.userDocuments = docRes?.data ?? docRes;
                    },
                    error: () => {
                      this.userDocuments = [];
                    }
                  });
              } else {
                this.fallbackToUserTable(userId);
              }
            },
            error: () => this.fallbackToUserTable(userId)
          });
        break;

      case 'DOCTOR':
      case 'DISPATCHER':
        this.http.get<any>(`${environment.apiBaseUrl}/staff/${userId}`, { headers })
          .subscribe({
            next: res => {
              const staff = res?.data ?? res;
              if (staff && (staff.staffId || staff.name)) {
                this.userExtraDetails = staff;
              } else {
                this.fallbackToUserTable(userId);
              }
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
      },
      error: () => {
        this.userExtraDetails = null;
      }
    });
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
}
