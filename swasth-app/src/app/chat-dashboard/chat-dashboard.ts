import { Component } from '@angular/core';
import { Auth } from '../core/auth';
import { ChatService } from '../services/chat.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-dashboard',
  standalone: true,
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
    private router: Router
  ) {}

  sendMessage() {

    if (!this.messageInput.trim()) return;

    const userText = this.messageInput.trim();

    // Push user message to chat
    this.messages.push({
      sender: 'user',
      text: userText
    });

    // Convert input to symptoms array
    const symptomsArray = userText
      .split(',')
      .map(s => s.trim().toLowerCase());

    console.log("Sending symptoms:", symptomsArray);

    this.chatService.sendSymptoms(symptomsArray).subscribe(

      (res: any) => {

        console.log("API RESPONSE:", res);

        // If backend sends success false
        if (res.success === false) {

          this.messages.push({
            sender: 'bot',
            text: res.error || "Invalid symptoms."
          });

          return;
        }

        // Push AI response
        this.messages.push({
          sender: 'bot',
          predictions: res.predictions,
          precautions: res.precautions || [],
          diet: res.diet || [],
          workout: res.workout || []
        });

      },

      (err) => {

        console.error("API ERROR:", err);

        const errorMessage =
          err?.error?.error ||
          "⚠️ Prediction failed. Please enter valid symptoms.";

        this.messages.push({
          sender: 'bot',
          text: errorMessage
        });

      }

    );

    // Clear input
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