import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminUsersFacade } from '../facades/admin-users-facade.service';

@Component({
  selector: 'app-admin-users-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-users-tab.html',
  styleUrl: '../admin.css'
})
export class AdminUsersTab {
  readonly vm = inject(AdminUsersFacade);
}
