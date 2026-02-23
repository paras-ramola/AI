import { CanActivateFn,Router  } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from './auth';


export const noAuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    router.navigate(['/chat']);
    return false;
  }

  return true;
};
