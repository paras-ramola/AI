import { Component, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
   encapsulation: ViewEncapsulation.None
})
export class Login {


email: string = '';
  password: string = '';
  errorMessage: string = '';
  showPassword: boolean = false;

    constructor(private router: Router, private auth: Auth) {}//dependency injection

 onLogin(): void {
  if (!this.email || !this.password) {
    this.errorMessage = 'Please fill in all fields.';
    return;
  }

  const loginData = {
    email: this.email,
    password: this.password
  };

  this.auth.login(loginData).subscribe({//.subscribe because auth.login return observable
    next: (res) => {
      this.auth.saveToken(res.token);
      this.router.navigate(['/chat']);
    },
    error: (err) => {
      this.errorMessage = 'Invalid credentials.';
    }
  });
}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }
}

//if someone back out of login or register they should move to home page instead of loopin