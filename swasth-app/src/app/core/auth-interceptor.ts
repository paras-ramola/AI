// To send token in HTTP headers.
// This is done using: HTTP Interceptor
// Every time Angular sends an HTTP request:
// Check if token exists
// If yes → add it in header -> Send request to backend
// Now backend knows which user is making request.

import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next(clonedRequest);
  }

  return next(req);
};
