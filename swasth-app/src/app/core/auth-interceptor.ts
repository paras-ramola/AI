// To send token in HTTP headers.
// This is done using: HTTP Interceptor
// Every time Angular sends an HTTP request:
// Check if token exists
// If yes → add it in header -> Send request to backend
// Now backend knows which user is making request.
// Also: auto-logout on 401/403 (expired or invalid token).

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Auth } from './auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  // Attach token to every outgoing request if present.
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  const router = inject(Router);
  const auth   = inject(Auth);

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // 401 = Unauthorized (expired/missing), 403 = Forbidden (tampered/invalid).
      if (err.status === 401 || err.status === 403) {
        auth.logout();             // clear token + profile cache
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
