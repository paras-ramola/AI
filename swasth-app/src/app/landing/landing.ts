import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
constructor(private router: Router) {}

  // Replace this with your actual auth service check
  private isLoggedIn(): boolean {
    // Example: check localStorage token or inject AuthService
    return !!localStorage.getItem('authToken');
  }

  onCtaClick(): void {
    if (this.isLoggedIn()) {
      this.router.navigate(['/chat']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}


