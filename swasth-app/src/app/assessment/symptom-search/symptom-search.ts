import { Component, OnInit }    from '@angular/core';
import { CommonModule }         from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { Router }               from '@angular/router';
import { ChatService }          from '../../services/chat.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector:    'app-symptom-search',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './symptom-search.html',
  styleUrl:    './symptom-search.scss'
})
export class SymptomSearch implements OnInit {

  searchQuery       = '';
  searchResults:    { symptom: string; display: string }[] = [];
  selectedSymptoms: { symptom: string; display: string }[] = [];
  isSearching       = false;
  isStarting        = false;
  errorMessage      = '';
  private search$   = new Subject<string>();

  constructor(
    private chatService: ChatService,
    private router:      Router
  ) {}

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      if (query.length >= 2) {
        this.performSearch(query);
      } else {
        this.searchResults = [];
      }
    });
  }

  onSearchInput(): void {
    this.search$.next(this.searchQuery);
  }

  performSearch(query: string): void {
    this.isSearching = true;
    this.chatService.searchSymptoms(query).subscribe({
      next: (res: any) => {
        this.searchResults = (res.results || []).filter(
          (r: any) => !this.selectedSymptoms.find(s => s.symptom === r.symptom)
        );
        this.isSearching = false;
      },
      error: () => {
        this.searchResults = [];
        this.isSearching   = false;
      }
    });
  }

  selectSymptom(item: { symptom: string; display: string }): void {
    if (!this.selectedSymptoms.find(s => s.symptom === item.symptom)) {
      this.selectedSymptoms.push(item);
    }
    this.searchQuery   = '';
    this.searchResults = [];
  }

  removeSymptom(symptom: string): void {
    this.selectedSymptoms = this.selectedSymptoms.filter(s => s.symptom !== symptom);
  }

  startAssessment(): void {
    if (this.selectedSymptoms.length === 0 || this.isStarting) return;

    this.isStarting  = true;
    this.errorMessage = '';

    const symptoms = this.selectedSymptoms.map(s => s.symptom);

    console.log('Starting assessment with symptoms:', symptoms);

    this.chatService.startAssessment(symptoms).subscribe({
      next: (res: any) => {
        this.isStarting = false;
        console.log('Assessment started:', res);

        if (res.status === 'emergency') {
          this.router.navigate(['/assess/emergency'], { state: { data: res } });
          return;
        }
        if (res.status === 'predicted') {
          this.router.navigate(['/assess/result'], { state: { data: res } });
          return;
        }
        // status = 'question'
        this.router.navigate(['/assess/question'], { state: { data: res } });
      },
      error: (err) => {
        this.isStarting   = false;
        this.errorMessage = 'Something went wrong. Please try again.';
        console.error('Start assessment failed:', err);
      }
    });
  }

  logout(): void {
    localStorage.removeItem('token');
    this.router.navigate(['/']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}