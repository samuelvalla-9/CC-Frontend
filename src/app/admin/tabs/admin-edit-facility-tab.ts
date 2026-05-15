import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminFacilitiesFacade } from '../facades/admin-facilities-facade.service';

@Component({
  selector: 'app-admin-edit-facility-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-edit-facility-tab.html',
  styleUrl: '../admin.css'
})
export class AdminEditFacilityTab {
  readonly vm = inject(AdminFacilitiesFacade);
}
