import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }  from '@angular/common';
import { Router }        from '@angular/router';
import { ChatService }   from '../../services/chat.service';
import { AssessmentRecommendations } from '../assessment-recommendations/assessment-recommendations';
import { NearbyFacilitiesComponent } from '../nearby-facilities/nearby-facilities';

@Component({
  selector:    'app-assessment-result',
  standalone:  true,
  imports:     [CommonModule, AssessmentRecommendations, NearbyFacilitiesComponent],
  templateUrl: './assessment-result.html',
  styleUrl:    './assessment-result.scss'
})
export class AssessmentResult implements OnInit {

  predictions:       any[]   = [];
  topDisease:        string  = '';
  topConfidence:     number  = 0;
  confirmedSymptoms: string[] = [];
  explanation:       string  = '';
  resultId:          number  = 0;
  sessionId:         string  = '';

  isLoadingExplanation = true;

  constructor(
    private router:      Router,
    private chatService: ChatService,
    private cdr:         ChangeDetectorRef
  ) {}

  ngOnInit(): void {

    // use history.state instead of navigation extras
    // history.state persists even after navigation completes
    const state = history.state?.data;

    console.log('Result screen state:', state);

    if (!state || !state.predictions) {
      console.warn('No state found — redirecting to assess');
      this.router.navigate(['/assess']);
      return;
    }

    this.predictions       = state.predictions        || [];
    this.confirmedSymptoms = state.confirmed_symptoms || [];
    this.sessionId         = state.session_id         || '';

    console.log('Session ID:', this.sessionId);
    console.log('Predictions:', this.predictions);
    console.log('Confirmed symptoms:', this.confirmedSymptoms);

    if (this.predictions.length > 0) {
      this.topDisease    = this.predictions[0].disease;
      this.topConfidence = this.predictions[0].confidence;
    }

    // fetch explanation
    this.chatService.getExplanation({
      session_id:  this.sessionId,
      disease:     this.topDisease,
      confidence:  this.topConfidence,
      symptoms:    this.confirmedSymptoms
    }).subscribe({
      next: (res: any) => {
        console.log('Explanation response:', res);
        this.explanation          = res.explanation || 'Please consult a doctor.';
        this.resultId             = res.result_id   || 0;
        this.isLoadingExplanation = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Explanation error:', err);
        this.explanation          = 'Please consult a qualified doctor for proper diagnosis and treatment.';
        this.isLoadingExplanation = false;
        this.cdr.detectChanges();
      }
    });
  }

  startNewAssessment(): void {
    this.router.navigate(['/assess']);
  }

  get confidencePercent(): string {
    return (this.topConfidence * 100).toFixed(0) + '%';
  }

  formatSymptom(s: string): string {
    return s.replace(/_/g, ' ');
  }

  viewHistory(): void {
    this.router.navigate(['/history']);
  }

  logout(): void {
    localStorage.removeItem('token');
    this.router.navigate(['/']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}