import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { Router }        from '@angular/router';
import { ChatService }   from '../../services/chat.service';

@Component({
  selector:    'app-assessment-result',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
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
  showFeedback         = false;
  dislikeComment       = '';
  feedbackSubmitted    = false;
  feedbackResponse     = '';
  feedbackLoading      = false;

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

  onLike(): void {
    this.chatService.submitAssessmentFeedback({
      result_id:         this.resultId,
      session_id:        this.sessionId,
      feedback_type:     'like',
      predicted_disease: this.topDisease,
      symptoms:          this.confirmedSymptoms,
      confidence:        this.topConfidence
    }).subscribe({
      next: (res: any) => {
        this.feedbackSubmitted = true;
        this.feedbackResponse  = res.message || 'Thank you for your feedback.';
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Like feedback error:', err)
    });
  }

  onDislike(): void {
    this.showFeedback = true;
    this.cdr.detectChanges();
  }

  submitDislike(): void {
    if (!this.dislikeComment.trim()) return;
    this.feedbackLoading = true;
    this.cdr.detectChanges();

    this.chatService.submitAssessmentFeedback({
      result_id:         this.resultId,
      session_id:        this.sessionId,
      feedback_type:     'dislike',
      user_comment:      this.dislikeComment,
      predicted_disease: this.topDisease,
      symptoms:          this.confirmedSymptoms,
      confidence:        this.topConfidence
    }).subscribe({
      next: (res: any) => {
        this.feedbackLoading = false;
        console.log('Feedback response:', res);

        if (res.status === 'continuing') {
          // user was right — restart questions with same session
          this.router.navigate(['/assess/question'], {
            state: {
              data: {
                session_id:         this.sessionId,
                confirmed_symptoms: this.confirmedSymptoms,
                absent_symptoms:    [],
                asked_symptoms:     [],
                questions_asked:    0,
                // trigger a fresh question fetch
                question:           res.response_to_patient,
                options:            ['Yes', 'No', 'Not sure'],
                symptom:            '',
                progress:           { asked: 0, max: 8 }
              }
            }
          });
          return;
        }

        // user was wrong — show explanation
        this.feedbackSubmitted = true;
        this.feedbackResponse  = res.response_to_patient || '';
        this.showFeedback      = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.feedbackLoading = false;
        console.error('Dislike feedback error:', err);
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

  logout(): void {
    localStorage.removeItem('token');
    this.router.navigate(['/']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}