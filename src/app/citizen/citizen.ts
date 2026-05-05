import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DatePipe, CommonModule } from '@angular/common';
import { Navbar } from '../shared/navbar';
import { ToastComponent } from '../shared/toast';
import { AuthService } from '../services/auth.service';
import { CitizenService, CitizenProfile, CitizenDocument } from '../services/citizen.service';
import { NotificationService } from '../services/notification.service';
import { ToastService } from '../services/toast.service';
import { Emergency } from '../../models/emergency.model';
import { Notification } from '../../models/notification.model';

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
  isEditMode = false;
  profileForm!: FormGroup;

  emergencyForm = { type: 'ACCIDENT', location: '', description: '' };
  emergencyTypes = ['ACCIDENT', 'HEART_ATTACK', 'FIRE', 'STROKE', 'FALL', 'OTHER'];
  errorMsg = '';

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
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit() {
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

  initForm() {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      contactInfo: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      address: ['', Validators.required]
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
        console.error('Profile load error:', err);
        if (err.status === 404) {
          console.log('Profile not found - entering edit mode to create profile');
          this.profile = null;
          this.isEditMode = true;
          this.activeTab = 'profile';
          // Pre-fill name from auth service
          const user = this.auth.getUser();
          if (user?.name) {
            this.profileForm.patchValue({ name: user.name });
          }
          this.toastService.showError('Please complete your profile to continue.');
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
    
    this.isEditMode = true;
  }

  cancelEdit() {
    this.isEditMode = false;
    this.profileForm.reset();
  }

  updateProfile() {
    if (this.profileForm.invalid) {
      this.toastService.showError('Please fill all required fields correctly');
      return;
    }
    
    this.errorMsg = '';
    const formValue = this.profileForm.value;
    
    // Convert date from yyyy-MM-dd to dd-MM-yyyy
    let formattedDate = '';
    if (formValue.dateOfBirth) {
      const [year, month, day] = formValue.dateOfBirth.split('-');
      formattedDate = `${day}-${month}-${year}`;
    }
    
    const payload: any = {
      name: formValue.name,
      dateOfBirth: formattedDate,
      gender: formValue.gender,
      contactInfo: formValue.contactInfo,
      address: formValue.address
    };
    
    this.citizenService.updateProfile(payload).subscribe({
      next: (updatedProfile) => {
        console.log('Profile saved:', updatedProfile);
        this.profile = updatedProfile;
        this.isEditMode = false;
        this.toastService.showSuccess('Profile updated successfully!');
        // Load documents after profile is created
        if (updatedProfile.citizenId) {
          this.loadDocuments();
        }
      },
      error: (err) => {
        console.error('Profile update error:', err);
        this.toastService.showError('Failed to update profile');
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
      error: (err) => {
        console.error('Documents load error:', err);
      }
    });
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  uploadDocument() {
    if (!this.selectedFile || !this.profile?.citizenId) {
      console.log('Upload blocked - selectedFile:', this.selectedFile, 'citizenId:', this.profile?.citizenId);
      return;
    }
    this.errorMsg = '';
    console.log('Uploading document:', this.selectedFile.name, 'for citizen:', this.profile.citizenId);
    this.citizenService.uploadDocument(this.profile.citizenId, this.selectedFile).subscribe({
      next: (doc) => { 
        console.log('Document uploaded successfully:', doc);
        this.selectedFile = null;
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        this.loadDocuments(); // This will update the BehaviorSubject
        this.toastService.showSuccess('Document uploaded successfully!');
      },
      error: (err) => {
        console.error('Upload error:', err);
        this.toastService.showError('Failed to upload document');
      }
    });
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
    // Step 1: Profile completeness check
    if (!this.citizenService.isProfileComplete()) {
      this.toastService.showError('Please update your profile details first.');
      this.activeTab = 'profile';
      return;
    }
    
    // Step 2: Verification check
    if (!this.citizenService.isVerified()) {
      this.toastService.showError('Document verification pending. You cannot report an emergency yet.');
      this.activeTab = 'documents';
      return;
    }
    
    // Step 3: Proceed with emergency report
    if (!this.profile?.citizenId) {
      this.toastService.showError('Profile not loaded. Please refresh the page.');
      return;
    }
    
    this.errorMsg = '';
    const payload = {
      ...this.emergencyForm,
      citizenId: this.profile.citizenId
    };
    
    console.log('Reporting emergency:', payload);
    this.http.post<any>('http://localhost:9090/emergencies/report', payload, { headers: this.headers })
      .subscribe({
        next: () => { 
          this.emergencyForm = { type: 'ACCIDENT', location: '', description: '' }; 
          this.loadEmergencies();
          this.toastService.showSuccess('Emergency reported successfully!');
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Emergency report error:', err);
          this.toastService.showError('Failed to report emergency: ' + (err.error?.message || err.message));
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
