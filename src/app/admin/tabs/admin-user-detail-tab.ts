import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminUsersFacade } from '../facades/admin-users-facade.service';

@Component({
  selector: 'app-admin-user-detail-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-user-detail-tab.html',
  styleUrl: '../admin.css'
})
export class AdminUserDetailTab {
  readonly vm = inject(AdminUsersFacade);
}
