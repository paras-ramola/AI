// Guard checks: Can user access this route? If not logged in:  → Redirect to login

import { CanActivateFn ,Router} from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from './auth';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);


//   If YES → allow
// If NO → send to /login
  if (auth.isLoggedIn()) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};


