import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }     from '@angular/common';
import { Router }           from '@angular/router';
import { ChatService }      from '../services/chat.service';
import { Auth }             from '../core/auth';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface HistoryEntry {
  id:                 number;
  predicted_disease:  string;
  confidence:         number;
  explanation:        string;
  feedback_type:      string | null;
  created_at:         string;
  confirmed_symptoms: string[];
  selected_symptoms:  string[];
}

@Component({
  selector:    'app-history',
  standalone:  true,
  imports:     [CommonModule],
  templateUrl: './history.html',
  styleUrl:    './history.scss',
})
export class HistoryPage implements OnInit {

  entries:   HistoryEntry[] = [];
  isLoading  = true;
  error      = '';
  expandedId: number | null = null;

  constructor(
    private chatService: ChatService,
    private router:      Router,
    private auth:        Auth,
    private cdr:         ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    console.log('[History] ngOnInit — calling getHistory()');

    this.chatService.getHistory()
      .pipe(
        timeout(10000),
        catchError((err: any) => {
          console.error('[History] request failed / timed out:', err);
          return of({ history: null, _error: err });
        })
      )
      .subscribe((res: any) => {
        console.log('[History] response received:', res);

        if (res._error || !res.history) {
          const status = res._error?.status;
          if (status === 401 || status === 403) {
            this.error = 'Session expired. Please log in again.';
          } else if (res._error?.name === 'TimeoutError') {
            this.error = 'Request timed out. Is the backend server running?';
          } else {
            this.error = `Could not load history (${status ?? 'network error'}). Make sure the backend is running with "npm run dev".`;
          }
        } else {
          this.entries = res.history.map((e: any) => ({
            ...e,
            confirmed_symptoms: this.parseJsonField(e.confirmed_symptoms),
            selected_symptoms:  this.parseJsonField(e.selected_symptoms),
          }));
        }

        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  private parseJsonField(val: any): string[] {
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val) || []; } catch { return []; }
  }

  toggle(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  isExpanded(id: number): boolean {
    return this.expandedId === id;
  }

  confidencePercent(c: number): string {
    return (c * 100).toFixed(0) + '%';
  }

  formatSymptom(s: string): string {
    return s.replace(/_/g, ' ');
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  feedbackIcon(type: string | null): string {
    if (type === 'like')    return '✅';
    if (type === 'dislike') return '❌';
    return '';
  }

  startNewAssessment(): void { this.router.navigate(['/assess']); }
  goHome():            void { this.router.navigate(['/']);       }
  logout():            void { this.auth.logout(); this.router.navigate(['/login']); }
}
