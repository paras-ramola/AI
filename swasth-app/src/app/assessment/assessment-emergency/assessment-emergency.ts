import { Component, OnInit } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { Router }            from '@angular/router';

@Component({
  selector:    'app-assessment-emergency',
  standalone:  true,
  imports:     [CommonModule],
  templateUrl: './assessment-emergency.html',
  styleUrl:    './assessment-emergency.scss'
})
export class AssessmentEmergency implements OnInit {

  emergencyData: any = null;

  constructor(private router: Router) {
    const nav = this.router.getCurrentNavigation();
    this.emergencyData = nav?.extras?.state?.['data'];
  }

  ngOnInit(): void {
    if (!this.emergencyData) {
      this.router.navigate(['/assess']);
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}