import { Component } from '@angular/core';
import { Auth } from '../core/auth';
import { ChatService } from '../services/chat.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-dashboard.html',
  styleUrl: './chat-dashboard.css',
})
export class ChatDashboard {
  messageInput = '';
  messages: any[] = [];

  constructor(
    private auth: Auth,
    private chatService: ChatService,
    private router: Router,
  ) {}

  //   onLogoutClick():void {
  // this.auth.logout()

  //   }
  sendMessage() {
    if (!this.messageInput.trim()) return;

    this.messages.push({
      sender: 'user',
      text: this.messageInput,
    });

    const symptomsArray = this.messageInput.split(',').map((s) => s.trim());

    this.chatService.sendSymptoms(symptomsArray).subscribe(
      (res: any) => {
        console.log('API Response:', res);

        const predictions = res.predictions;

        this.messages.push({
          sender: 'bot',
          predictions: predictions,
        });
      },
      (err) => {
        this.messages.push({
          sender: 'bot',
          text: 'Prediction failed. Please try again.',
        });
      },
    );

    this.messageInput = '';
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/']);
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
