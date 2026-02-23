import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { Login } from './login/login';
import { ChatDashboard } from './chat-dashboard/chat-dashboard';
import { Register } from './register/register';
import { authGuard } from './core/auth-guard';  // make sure this path is correct
import { noAuthGuard } from './core/no-auth-guard';

export const routes: Routes = [
  { path: '', component: Landing }, // default page
  {
  path: 'login',
  component: Login,
  canActivate: [noAuthGuard]
},
  { path: 'register', component: Register },

  {
    path: 'chat',
    component: ChatDashboard,
    canActivate: [authGuard]   // runs authGuard(canActivate type before routing to /chat)
  }
];