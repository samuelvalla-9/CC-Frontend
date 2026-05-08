import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DatePipe, CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Navbar } from '../shared/navbar';
import { ToastComponent } from '../shared/toast';
import { AuthService } from '../services/auth.service';
import { CitizenService, CitizenProfile, CitizenDocument } from '../services/citizen.service';
import { NotificationService } from '../services/notification.service';
import { ToastService } from '../services/toast.service';
import { Emergency } from '../../models/emergency.model';
import { Notification } from '../../models/notification.model';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-citizen',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, Navbar, DatePipe, ToastComponent],
  templateUrl: './citizen.html',
  styleUrl: './citizen.css',
})
export class CitizenDashboard implements OnInit {
  activeTab = 'overview';
  emergencies: Emergency[] = [];
  notifications: Notification[] = [];
  unreadCount = 0;
  profile: CitizenProfile | null = null;
  documents: CitizenDocument[] = [];
  selectedFile: File | null = null;
  documentPreviewUrl: SafeResourceUrl | null = null;
  documentIsImage = false;
  isEditMode = false;
  profileForm!: FormGroup;

  emergencyForm!: FormGroup;
  emergencyTypes = ['ACCIDENT', 'HEART_ATTACK', 'FIRE', 'STROKE', 'FALL', 'OTHER'];
  errorMsg = '';
  isSavingProfile = false;
  isUploadingDoc = false;
  isReportingEmergency = false;

  get pendingCount() { return this.emergencies.filter(e => e.status === 'REPORTED').length; }
  get resolvedCount() { return this.emergencies.filter(e => e.status === 'CLOSED').length; }
  get pendingDocsCount() { return this.documents.filter(d => d.verificationStatus === 'PENDING').length; }

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private citizenService: CitizenService,
    private notificationService: NotificationService,
    private toastService: ToastService,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.handleTabChange(this.activeTab);
      }
    });

    this.loadEmergencies();
    this.loadNotifications();
    this.loadProfile();

    // Subscribe to profile changes
    this.citizenService.profile$.subscribe(profile => {
      if (profile) {
        this.profile = profile;
        this.cdr.markForCheck();
      }
    });

    // Subscribe to document changes
    this.citizenService.documents$.subscribe(docs => {
      this.documents = docs;
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
    if (tab === 'profile') this.loadProfile();
    if (tab === 'documents') this.loadDocuments();
    if (tab === 'notifications') this.loadNotifications();
    if (tab === 'emergencies') this.loadEmergencies();
  }

  initForm() {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[A-Za-z\s]+$/)]],
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      contactInfo: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      address: ['', Validators.required]
    });
    this.emergencyForm = this.fb.group({
      type: ['ACCIDENT', Validators.required],
      location: ['', [Validators.required, Validators.minLength(3)]],
      description: ['']
    });
  }

  loadProfile() {
    this.citizenService.getMyProfile().subscribe({
      next: p => {
        console.log('Profile loaded:', p);
        this.profile = p;
        this.loadDocuments();
      },
      error: (err) => {
        if (err.status === 404) {
          this.profile = null;
          this.isEditMode = true;
          this.setTab('profile');
          const user = this.auth.getUser();
          if (user?.name) {
            this.profileForm.patchValue({ name: user.name });
          }
          this.toastService.showWarning('Please complete your profile to continue.');
        } else {
          this.toastService.showError('Failed to load profile');
        }
      }
    });
  }

  enterEditMode() {
    if (!this.profile) return;

    // Convert date from dd-MM-yyyy to yyyy-MM-dd for HTML input
    let htmlDate = '';
    if (this.profile.dateOfBirth) {
      const parts = this.profile.dateOfBirth.split('-');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        htmlDate = `${year}-${month}-${day}`;
      }
    }

    this.profileForm.patchValue({
      name: this.profile.name || '',
      dateOfBirth: htmlDate,
      gender: this.profile.gender || '',
      contactInfo: this.profile.contactInfo || '',
      address: this.profile.address || ''
    });

    // After initial profile creation, remove required validators to allow partial updates
    this.removeRequiredValidators();

    this.isEditMode = true;
  }

  private removeRequiredValidators() {
    this.profileForm.get('name')?.setValidators([Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[A-Za-z\s]+$/)]);
    this.profileForm.get('dateOfBirth')?.clearValidators();
    this.profileForm.get('gender')?.clearValidators();
    this.profileForm.get('contactInfo')?.setValidators([Validators.pattern(/^[0-9]{10}$/)]);
    this.profileForm.get('address')?.clearValidators();
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.updateValueAndValidity();
    });
  }

  private restoreRequiredValidators() {
    this.profileForm.get('name')?.setValidators([Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[A-Za-z\s]+$/)]);
    this.profileForm.get('dateOfBirth')?.setValidators([Validators.required]);
    this.profileForm.get('gender')?.setValidators([Validators.required]);
    this.profileForm.get('contactInfo')?.setValidators([Validators.required, Validators.pattern(/^[0-9]{10}$/)]);
    this.profileForm.get('address')?.setValidators([Validators.required]);
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.updateValueAndValidity();
    });
  }

  cancelEdit() {
    this.isEditMode = false;
    this.profileForm.reset();
    this.restoreRequiredValidators();
  }

  updateProfile() {
    if (this.isSavingProfile) return;
    this.errorMsg = '';
    const formValue = this.profileForm.value;

    // Convert date from yyyy-MM-dd to dd-MM-yyyy
    let formattedDate = '';
    if (formValue.dateOfBirth) {
      const [year, month, day] = formValue.dateOfBirth.split('-');
      formattedDate = `${day}-${month}-${year}`;
    }

    // For initial profile creation (no existing profile), require all fields
    if (!this.profile) {
      if (this.profileForm.invalid) {
        this.toastService.showError('Please fill all required fields correctly');
        return;
      }
      if (!formValue.name || !formattedDate || !formValue.gender || !formValue.contactInfo || !formValue.address) {
        this.toastService.showError('Please fill all fields for initial profile setup');
        return;
      }
    } else {
      // For partial updates, only validate fields that were actually changed
      const changedFields = Object.keys(this.profileForm.controls).filter(key => {
        const control = this.profileForm.get(key);
        return control?.dirty && control?.value;
      });

      if (changedFields.length === 0) {
        this.toastService.showWarning('No changes detected');
        return;
      }

      // Validate only the changed fields
      const invalidFields = changedFields.filter(key => this.profileForm.get(key)?.invalid);
      if (invalidFields.length > 0) {
        this.toastService.showError('Please correct the highlighted fields');
        return;
      }
    }

    // Build payload: for partial updates (profile exists), only send changed fields
    const payload: any = {};
    if (this.profile) {
      // Only include dirty (changed) fields
      if (this.profileForm.get('name')?.dirty && formValue.name) payload.name = formValue.name;
      if (this.profileForm.get('dateOfBirth')?.dirty && formattedDate) payload.dateOfBirth = formattedDate;
      if (this.profileForm.get('gender')?.dirty && formValue.gender) payload.gender = formValue.gender;
      if (this.profileForm.get('contactInfo')?.dirty && formValue.contactInfo) payload.contactInfo = formValue.contactInfo;
      if (this.profileForm.get('address')?.dirty && formValue.address) payload.address = formValue.address;
    } else {
      payload.name = formValue.name;
      payload.dateOfBirth = formattedDate;
      payload.gender = formValue.gender;
      payload.contactInfo = formValue.contactInfo;
      payload.address = formValue.address;
    }

    this.isSavingProfile = true;
    this.citizenService.updateProfile(payload).subscribe({
      next: (updatedProfile) => {
        this.isSavingProfile = false;
        console.log('Profile saved:', updatedProfile);
        this.profile = updatedProfile;
        this.isEditMode = false;
        this.restoreRequiredValidators();
        this.toastService.showSuccess('Profile updated successfully!');
        // Load documents after profile is created
        if (updatedProfile.citizenId) {
          this.loadDocuments();
        }
      },
      error: (err) => {
        this.isSavingProfile = false;
        if (err.status === 409) {
          this.toastService.showError('This phone number is already registered');
          this.errorMsg = 'This phone number is already registered. Please use a different number.';
        } else {
          this.toastService.showError('Failed to update profile');
          this.errorMsg = 'Failed to update profile. Please try again.';
        }
      }
    });
  }

  loadDocuments() {
    if (!this.profile?.citizenId) {
      console.log('Cannot load documents - citizenId missing. Profile:', this.profile);
      return;
    }
    this.citizenService.getMyDocuments(this.profile.citizenId).subscribe({
      next: d => {
        console.log('Documents loaded:', d);
        this.documents = [...d];
      },
      error: () => {
        this.toastService.showError('Failed to load documents');
      }
    });
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  uploadDocument() {
    if (this.isUploadingDoc) return;
    if (!this.selectedFile || !this.profile?.citizenId) {
      console.log('Upload blocked - selectedFile:', this.selectedFile, 'citizenId:', this.profile?.citizenId);
      return;
    }
    this.errorMsg = '';
    this.isUploadingDoc = true;
    console.log('Uploading document:', this.selectedFile.name, 'for citizen:', this.profile.citizenId);
    this.citizenService.uploadDocument(this.profile.citizenId, this.selectedFile).subscribe({
      next: (doc) => {
        this.isUploadingDoc = false;
        console.log('Document uploaded successfully:', doc);
        this.selectedFile = null;
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        this.loadDocuments(); // This will update the BehaviorSubject
        this.toastService.showSuccess('Document uploaded successfully!');
      },
      error: () => {
        this.isUploadingDoc = false;
        this.toastService.showError('Failed to upload document');
      }
    });
  }

  viewDocument(doc: CitizenDocument) {
    if (!this.profile?.citizenId) return;
    this.documentPreviewUrl = null;
    this.citizenService.getDocumentBlob(this.profile.citizenId, doc.documentId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        this.documentIsImage = blob.type.startsWith('image/');
        this.documentPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.cdr.markForCheck();
      },
      error: () => this.toastService.showError('Failed to load document')
    });
  }

  closePreview() {
    this.documentPreviewUrl = null;
  }

  loadEmergencies() {
    const userId = this.auth.getUser()?.id;
    this.http.get<any>(`http://localhost:9090/emergencies/my`, { headers: this.headers })
      .subscribe({
        next: d => {
          this.emergencies = d?.data ?? d;
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

  reportEmergency() {
    if (this.isReportingEmergency) return;
    // Step 0: Form validation
    if (this.emergencyForm.invalid) {
      this.emergencyForm.markAllAsTouched();
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }

    // Step 1: Profile completeness check
    if (!this.citizenService.isProfileComplete()) {
      this.toastService.showError('Please update your profile details first.');
      this.setTab('profile');
      return;
    }

    // Step 2: Verification check
    if (!this.citizenService.isVerified()) {
      this.toastService.showError('Document verification pending. You cannot report an emergency yet.');
      this.setTab('documents');
      return;
    }

    // Step 3: Proceed with emergency report
    if (!this.profile?.citizenId) {
      this.toastService.showError('Profile not loaded. Please refresh the page.');
      return;
    }

    this.errorMsg = '';
    const payload = {
      ...this.emergencyForm.value,
      citizenId: this.profile.citizenId
    };

    this.isReportingEmergency = true;
    console.log('Reporting emergency:', payload);
    this.http.post<any>('http://localhost:9090/emergencies/report', payload, { headers: this.headers })
      .subscribe({
        next: () => {
          this.isReportingEmergency = false;
          this.emergencyForm.reset({ type: 'ACCIDENT', location: '', description: '' });
          this.loadEmergencies();
          this.toastService.showSuccess('Emergency reported successfully!');
          this.cdr.detectChanges();
        },
        error: () => {
          this.isReportingEmergency = false;
          this.toastService.showError('Failed to report emergency');
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
}

