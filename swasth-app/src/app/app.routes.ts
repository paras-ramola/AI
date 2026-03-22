import { Routes }        from '@angular/router';
import { Landing }       from './landing/landing';
import { Login }         from './login/login';
import { Register }      from './register/register';
import { ChatDashboard } from './chat-dashboard/chat-dashboard';
import { authGuard }     from './core/auth-guard';
import { noAuthGuard }   from './core/no-auth-guard';

export const routes: Routes = [
  { path: '',         component: Landing                        },
  { path: 'login',    component: Login,  canActivate: [noAuthGuard] },
  { path: 'register', component: Register                       },
  {
    path:        'chat',
    component:   ChatDashboard,
    canActivate: [authGuard]
  },
  {
    path:        'assess',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./assessment/assessment.routes')
        .then(m => m.ASSESSMENT_ROUTES)
  },
  { path: '**', redirectTo: '' }
];