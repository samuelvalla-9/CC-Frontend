import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { tap } from 'rxjs';
import { routes } from './app.routes';

function jwtInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const token = sessionStorage.getItem('token');
  if (token) {
    req = req.clone({ setHeaders: {
      Authorization: `Bearer ${token}`
    }});
  }
  return next(req);
}

function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  return next(req).pipe(
    tap({
      error: (err) => {
        if (err.status === 401 && !req.url.includes('/auth/login')) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          window.location.href = '/login';
        }
        if (err.status === 403) {
          console.warn('Access denied (403):', req.url);
        }
      }
    })
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),
  ]
};
