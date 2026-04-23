import { Component, OnInit } from '@angular/core';
import { Router }            from '@angular/router';
import { CommonModule }      from '@angular/common';

@Component({
  selector:   'app-chat-dashboard',
  standalone: true,
  imports:    [CommonModule],
  template:   `
    <div style="display:flex;align-items:center;justify-content:center;
                height:100vh;flex-direction:column;gap:1rem;font-family:sans-serif;">
      <p style="color:#6b7280;">Redirecting to assessment...</p>
    </div>
  `
})
export class ChatDashboard implements OnInit {
  constructor(private router: Router) {}
  ngOnInit(): void {
    this.router.navigate(['/assess']);
  }
}