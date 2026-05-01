import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../services/chat.service';
import { UserService } from '../../core/user.service';

export type CardKey = 'diet' | 'workout' | 'precautions';

@Component({
  selector: 'app-assessment-recommendations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assessment-recommendations.html',
  styleUrl: './assessment-recommendations.scss'
})
export class AssessmentRecommendations implements OnInit {

  @Input() disease:    string   = '';
  @Input() symptoms:   string[] = [];
  @Input() confidence: number   = 0;

  // ── per-card independent state ───────────────────────────────────────────────
  expanded: Record<CardKey, boolean> = { diet: false, workout: false, precautions: false };
  loading:  Record<CardKey, boolean> = { diet: false, workout: false, precautions: false };
  fetched:  Record<CardKey, boolean> = { diet: false, workout: false, precautions: false };
  data:     Record<CardKey, any>     = { diet: null,  workout: null,  precautions: null  };
  error:    Record<CardKey, boolean> = { diet: false,  workout: false,  precautions: false };

  userAge:    number | null = null;
  userGender: string | null = null;

  readonly cards: { key: CardKey; label: string; emoji: string; tagline: string }[] = [
    { key: 'diet',        label: 'Diet Plan',      emoji: '🥗', tagline: 'Foods to eat & avoid for your condition' },
    { key: 'workout',     label: 'Activity Plan',  emoji: '🏃', tagline: 'Exercise guidance based on your health'  },
    { key: 'precautions', label: 'Precautions',    emoji: '⚠️', tagline: 'Warning signs & daily habits to follow'  },
  ];

  constructor(
    private chatService: ChatService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    const profile = this.userService.getProfile();
    if (profile) {
      this.userAge    = profile.age;
      this.userGender = profile.gender;
    }
  }

  // ── toggle a card — only fetches ITS section ─────────────────────────────────
  toggle(key: CardKey): void {
    const isOpen = this.expanded[key];

    // collapse all first
    (Object.keys(this.expanded) as CardKey[]).forEach(k => this.expanded[k] = false);

    if (isOpen) return; // clicking open card → just closes it

    this.expanded[key] = true;

    // already fetched → just show cached data
    if (this.fetched[key]) return;

    // ── fetch ONLY this section ──────────────────────────────────────────────
    this.loading[key] = true;
    this.error[key]   = false;

    this.chatService.getRecommendations({
      disease:    this.disease,
      confidence: this.confidence,
      symptoms:   this.symptoms,
      section:    key,                  // ← tells backend which section to generate
    }).subscribe({
      next: (res: any) => {
        this.data[key]    = res;
        this.fetched[key] = true;
        this.loading[key] = false;
      },
      error: () => {
        this.error[key]   = true;
        this.fetched[key] = true;
        this.loading[key] = false;
      }
    });
  }

  isExpanded(key: CardKey): boolean { return this.expanded[key]; }
  isLoading(key: CardKey):  boolean { return this.loading[key];  }
  hasError(key: CardKey):   boolean { return this.error[key];    }

  get intensityBadge(): { label: string; cls: string } {
    const i = this.data['workout']?.intensity || 'light';
    const map: Record<string, { label: string; cls: string }> = {
      rest:     { label: '🔴 Rest Required',  cls: 'badge-rest'     },
      light:    { label: '🟡 Light Activity', cls: 'badge-light'    },
      moderate: { label: '🟢 Moderate',       cls: 'badge-moderate' },
      active:   { label: '🟢 Stay Active',    cls: 'badge-active'   },
    };
    return map[i] ?? map['light'];
  }
}
