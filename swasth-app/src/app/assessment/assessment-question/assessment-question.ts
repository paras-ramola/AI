import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { Auth } from '../../core/auth';

@Component({
  selector: 'app-assessment-question',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assessment-question.html',
  styleUrl: './assessment-question.scss',
})
export class AssessmentQuestion implements OnInit {
  sessionId: string = '';
  question: string = '';
  options: string[] = [];
  currentSymptom: string = '';
  questionsAsked: number = 0;
  maxQuestions: number = 10;
  confirmedSymptoms: string[] = [];
  absentSymptoms: string[] = [];
  askedSymptoms: string[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private router:      Router,
    private chatService: ChatService,
    private cdr:         ChangeDetectorRef,
    private auth:        Auth,
  ) {}

  ngOnInit(): void {
    const state = history.state?.data;
    if (!state) {
      this.router.navigate(['/assess']);
      return;
    }
    this.loadFromData(state);
  }

  loadFromData(data: any): void {
    this.sessionId = data.session_id || '';
    this.question = data.question || '';
    this.options = data.options || ['Yes', 'No', 'Not sure'];
    this.currentSymptom = data.symptom || '';
    this.questionsAsked = data.questions_asked || 0;
    this.confirmedSymptoms = data.confirmed_symptoms || [];
    this.absentSymptoms = data.absent_symptoms || [];
    this.askedSymptoms = data.asked_symptoms || [];
    this.maxQuestions = data.progress?.max || 10;
    this.isLoading = false; // ← make sure this is false
    this.errorMessage = '';

    // ── force Angular to re-render the view ──────────────────────────────────
    this.cdr.detectChanges();

    console.log('Question loaded:', this.question);
    console.log('Symptom:', this.currentSymptom);
    console.log('Confirmed:', this.confirmedSymptoms);
  }

  answer(option: string): void {
    if (this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges(); // ← show spinner immediately

    const payload = {
      session_id: this.sessionId,
      symptom: this.currentSymptom,
      answer: option,
      confirmed_symptoms: this.confirmedSymptoms,
      absent_symptoms: this.absentSymptoms,
      asked_symptoms: this.askedSymptoms,
      questions_asked: this.questionsAsked,
    };

    console.log('Submitting answer:', payload);

    this.chatService.submitAnswer(payload).subscribe({
      next: (res: any) => {
        console.log('Answer response:', res);

        if (res.status === 'emergency') {
          this.router.navigate(['/assess/emergency'], { state: { data: res } });
          return;
        }

        if (res.status === 'predicted') {
          this.router.navigate(['/assess/result'], { state: { data: res } });
          return;
        }

        // next question — update in place
        this.loadFromData(res);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Something went wrong. Please try again.';
        this.cdr.detectChanges();
        console.error('Answer error:', err);
      },
    });
  }

  get progressPercent(): number {
    return Math.round((this.questionsAsked / this.maxQuestions) * 100);
  }

  formatSymptom(s: string): string {
    return s.replace(/_/g, ' ');
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
