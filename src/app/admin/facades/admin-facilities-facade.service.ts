import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { FacilityService } from '../../services/facility.service';
import { ToastService } from '../../services/toast.service';
import { Facility, FacilityStatus, FacilityType } from '../../../models/facility.model';

@Injectable()
export class AdminFacilitiesFacade {
  facilities: Facility[] = [];
  filteredFacilities: Facility[] = [];
  selectedFacility: Facility | null = null;

  showAddFacility = false;
  isSavingFacility = false;
  isEditingFacility = false;
  errorMsg = '';

  facilityStatusFilter: FacilityStatus | 'ALL' = 'ALL';
  facilitySort: { key: 'facilityId' | 'name' | 'type' | 'location' | 'capacity' | 'status'; direction: 'asc' | 'desc' } = {
    key: 'facilityId',
    direction: 'asc'
  };

  readonly FacilityStatus = FacilityStatus;
  readonly FacilityType = FacilityType;

  facilityForm: FormGroup;
  editFacilityForm: FormGroup;

  private readonly actionInFlight = new Set<string>();

  constructor(
    private readonly facilityService: FacilityService,
    private readonly toastService: ToastService,
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
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
  }

  loadFacilities() {
    this.facilityService.getAllFacilities().subscribe({
      next: data => {
        this.facilities = data;
        this.applyFacilityFilter();
      },
      error: () => {}
    });
  }

  toggleAddFacility() {
    this.showAddFacility = !this.showAddFacility;
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
        },
        error: err => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to add facility'));
        }
      });
  }

  onFacilityFilterChange() {
    this.applyFacilityFilter();
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
        },
        error: err => {
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
        },
        error: err => {
          this.toastService.showError(this.extractErrorMessage(err, 'Failed to update facility status'));
        }
      });
  }

  isActionInFlight(actionKey: string): boolean {
    return this.actionInFlight.has(actionKey);
  }

  facilityStatusActionKey(facilityId: number, status: FacilityStatus): string {
    return `facility-status:${facilityId}:${status}`;
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

  private compareGridValues(aValue: any, bValue: any): number {
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return -1;
    if (bValue == null) return 1;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return aValue - bValue;
    }

    return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' });
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

  private setTab(tab: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }
}
