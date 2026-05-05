import { Routes } from '@angular/router';
import { Login } from './login/login';
import { CitizenDashboard } from './citizen/citizen';
import { DoctorDashboard } from './doctor/doctor';
import { NurseDashboard } from './nurse/nurse';
import { DispatcherDashboard } from './dispatcher/dispatcher';
import { AdminDashboard } from './admin/admin';
import { OfficerDashboard } from './officer/officer';
import { ComplianceDashboard } from './compliance/compliance';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'citizen',    component: CitizenDashboard,    canActivate: [authGuard(['CITIZEN'])] },
  { path: 'doctor',     component: DoctorDashboard,     canActivate: [authGuard(['DOCTOR', 'NURSE'])] },
  { path: 'nurse',      component: NurseDashboard,      canActivate: [authGuard(['NURSE'])] },
  { path: 'dispatcher', component: DispatcherDashboard, canActivate: [authGuard(['DISPATCHER'])] },
  { path: 'admin',      component: AdminDashboard,      canActivate: [authGuard(['ADMIN'])] },
  { path: 'officer',    component: OfficerDashboard,    canActivate: [authGuard(['CITY_HEALTH_OFFICER'])] },
  { path: 'compliance', component: ComplianceDashboard, canActivate: [authGuard(['COMPLIANCE_OFFICER'])] },
  { path: '**', redirectTo: 'login' },
];
