import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../../models/user.model';

export function authGuard(allowedRoles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) {
      router.navigate(['/login']);
      return false;
    }
    const role = auth.getUser()?.role;
    if (role && allowedRoles.includes(role)) return true;
    auth.redirectByRole();
    return false;
  };
}
