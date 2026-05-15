import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminAmbulancesFacade } from '../facades/admin-ambulances-facade.service';

@Component({
  selector: 'app-admin-ambulances-tab',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-ambulances-tab.html',
  styleUrl: '../admin.css'
})
export class AdminAmbulancesTab {
  readonly vm = inject(AdminAmbulancesFacade);
}
