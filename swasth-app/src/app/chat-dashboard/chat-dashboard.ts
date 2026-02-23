import { Component } from '@angular/core';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-chat-dashboard',
  imports: [],
  templateUrl: './chat-dashboard.html',
  styleUrl: './chat-dashboard.css',
})
export class ChatDashboard {

  constructor(private auth: Auth){}

  onLogoutClick():void {
this.auth.logout()

  }
}
