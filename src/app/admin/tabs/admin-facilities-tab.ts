import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminFacilitiesFacade } from '../facades/admin-facilities-facade.service';

@Component({
  selector: 'app-admin-facilities-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-facilities-tab.html',
  styleUrl: '../admin.css'
})
export class AdminFacilitiesTab {
  readonly vm = inject(AdminFacilitiesFacade);
}
