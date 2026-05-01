// Attaches the JWT Bearer token to every outgoing request.
// Also auto-redirects to /login on 401/403 responses.

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  // Attach token to every outgoing request if present.
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  // NOTE: We intentionally do NOT inject Auth here to avoid a circular
  // dependency (interceptor → Auth → HttpClient → interceptor).
  // Instead we clear localStorage directly, which is equivalent.
  const router = inject(Router);

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // 401 = expired/missing token, 403 = tampered/invalid token.
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem('token');   // clear token directly
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
