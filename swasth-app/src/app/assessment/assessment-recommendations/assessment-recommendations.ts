import { Component, Input, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../services/chat.service';
import { UserService } from '../../core/user.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

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

  isDownloading = false;

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
    private ngZone:      NgZone,
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

    this.fetchSection(key);
  }

  private fetchSection(key: CardKey): void {
    this.loading[key] = true;
    this.error[key]   = false;

    this.chatService.getRecommendations({
      disease:    this.disease,
      confidence: this.confidence,
      symptoms:   this.symptoms,
      section:    key,
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

  get anyFetched(): boolean {
    return this.fetched['diet'] || this.fetched['workout'] || this.fetched['precautions'];
  }

  // ── PDF Download ─────────────────────────────────────────────────────────────
  async downloadPdf(): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;

    try {
    // 1. Fetch any sections not yet loaded
    const sections: CardKey[] = ['diet', 'workout', 'precautions'];
    const missing = sections.filter(k => !this.fetched[k]);

    if (missing.length > 0) {
      await Promise.all(
        missing.map(key =>
          new Promise<void>(resolve => {
            this.chatService.getRecommendations({
              disease:    this.disease,
              confidence: this.confidence,
              symptoms:   this.symptoms,
              section:    key,
            }).pipe(catchError(() => of(null))).subscribe(res => {
              if (res) {
                this.data[key]    = res;
                this.fetched[key] = true;
              }
              resolve();
            });
          })
        )
      );
    }

    // 2. Dynamically import jsPDF (avoids bloating the initial bundle)
    const { jsPDF } = await import('jspdf');
    const autoTable  = (await import('jspdf-autotable')).default;

    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw   = doc.internal.pageSize.getWidth();
    let   y    = 0;

    // ── Helper functions ───────────────────────────────────────────────────────
    const addPage = () => { doc.addPage(); y = 20; };
    const checkY  = (need: number) => { if (y + need > 275) addPage(); };

    // ── Header banner ──────────────────────────────────────────────────────────
    doc.setFillColor(99, 102, 241);        // indigo
    doc.rect(0, 0, pw, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Swasth Health Plan', pw / 2, 15, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Condition: ${this.disease}`, pw / 2, 23, { align: 'center' });

    const meta: string[] = [];
    if (this.userAge)    meta.push(`Age ${this.userAge}`);
    if (this.userGender) meta.push(this.userGender);
    meta.push(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
    doc.text(meta.join('  ·  '), pw / 2, 30, { align: 'center' });

    const conf = (this.confidence * 100).toFixed(0);
    doc.text(`Confidence: ${conf}%`, pw / 2, 36, { align: 'center' });

    y = 48;

    // ── Section helper ─────────────────────────────────────────────────────────
    const sectionTitle = (title: string, emoji: string) => {
      checkY(14);
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(14, y, pw - 28, 10, 2, 2, 'F');
      doc.setTextColor(55, 48, 163);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`${emoji}  ${title}`, 20, y + 7);
      y += 14;
    };

    const subTitle = (text: string, color: [number, number, number] = [31, 41, 55]) => {
      checkY(8);
      doc.setTextColor(...color);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(text, 18, y);
      y += 5;
    };

    const bodyText = (text: string) => {
      checkY(7);
      doc.setTextColor(75, 85, 99);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(text, pw - 40);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 2;
    };

    const tip = (label: string, text: string, bg: [number, number, number], fg: [number, number, number]) => {
      checkY(12);
      doc.setFillColor(...bg);
      doc.roundedRect(14, y - 3, pw - 28, 10, 2, 2, 'F');
      doc.setTextColor(...fg);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(label, 18, y + 3);
      doc.setFont('helvetica', 'normal');
      const t = doc.splitTextToSize(text, pw - 50);
      doc.text(t, 34, y + 3);
      y += t.length * 5 + 5;
    };

    // ── 1. DIET ───────────────────────────────────────────────────────────────
    const diet = this.data['diet'];
    if (diet) {
      sectionTitle('Diet Plan', '🥗');

      if (diet.eat?.length) {
        subTitle('✅  Foods to Eat', [5, 150, 105]);
        const rows = diet.eat.map((item: any) => [item.food, item.reason]);
        autoTable(doc, {
          startY: y,
          head:   [['Food', 'Reason']],
          body:   rows,
          margin: { left: 18, right: 14 },
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [5, 150, 105], textColor: 255 },
          alternateRowStyles: { fillColor: [240, 253, 244] },
          didDrawPage: (d: any) => { y = d.cursor.y; }
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      }

      if (diet.avoid?.length) {
        subTitle('❌  Foods to Avoid', [220, 38, 38]);
        const rows = diet.avoid.map((item: any) => [item.food, item.reason]);
        autoTable(doc, {
          startY: y,
          head:   [['Food', 'Reason']],
          body:   rows,
          margin: { left: 18, right: 14 },
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [220, 38, 38], textColor: 255 },
          alternateRowStyles: { fillColor: [254, 242, 242] },
          didDrawPage: (d: any) => { y = d.cursor.y; }
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      }

      if (diet.hydration) tip('💧 Hydration', diet.hydration, [224, 242, 254], [7, 89, 133]);
      if (diet.meal_tip)  tip('🕐 Meal Tip',  diet.meal_tip,  [255, 251, 235], [146, 64, 14]);
      y += 4;
    }

    // ── 2. WORKOUT ────────────────────────────────────────────────────────────
    const workout = this.data['workout'];
    if (workout) {
      checkY(20);
      sectionTitle('Activity Plan', '🏃');
      bodyText(`Intensity: ${workout.intensity || 'light'}`);

      if (workout.recommended?.length) {
        subTitle('🏃 Recommended Exercises', [5, 150, 105]);
        const rows = workout.recommended.map((ex: any) =>
          [ex.exercise, ex.duration || '—', ex.frequency || '—']
        );
        autoTable(doc, {
          startY: y,
          head:   [['Exercise', 'Duration', 'Frequency']],
          body:   rows,
          margin: { left: 18, right: 14 },
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [5, 150, 105], textColor: 255 },
          didDrawPage: (d: any) => { y = d.cursor.y; }
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      }

      if (workout.avoid?.length) {
        subTitle('🚫 Avoid', [220, 38, 38]);
        workout.avoid.forEach((a: string) => bodyText(`• ${a}`));
      }

      if (workout.note) tip('ℹ️ Note', workout.note, [243, 244, 246], [55, 65, 81]);
      y += 4;
    }

    // ── 3. PRECAUTIONS ────────────────────────────────────────────────────────
    const prec = this.data['precautions'];
    if (prec) {
      checkY(20);
      sectionTitle('Precautions', '⚠️');

      if (prec.daily?.length) {
        subTitle('📋 Daily Habits', [5, 150, 105]);
        prec.daily.forEach((d: string) => bodyText(`✅  ${d}`));
        y += 2;
      }

      if (prec.warning_signs?.length) {
        subTitle('🔴 Warning Signs — See a Doctor If:', [220, 38, 38]);
        prec.warning_signs.forEach((w: string) => bodyText(`• ${w}`));
        y += 2;
      }

      if (prec.when_to_seek) tip('🏥 When to Seek Help', prec.when_to_seek, [255, 251, 235], [146, 64, 14]);

      if (prec.do?.length || prec.dont?.length) {
        checkY(20);
        subTitle("✔ Do's & ✗ Don'ts", [55, 65, 81]);
        const rows: string[][] = [];
        const maxLen = Math.max(prec.do?.length || 0, prec.dont?.length || 0);
        for (let i = 0; i < maxLen; i++) {
          rows.push([prec.do?.[i] || '', prec.dont?.[i] || '']);
        }
        autoTable(doc, {
          startY: y,
          head:   [["✔ Do", "✗ Don't"]],
          body:   rows,
          margin: { left: 18, right: 14 },
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255 },
          didDrawPage: (d: any) => { y = d.cursor.y; }
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      }
    }

    // ── Footer disclaimer ─────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.text(
        '⚕️  AI-generated guidance only — not a substitute for professional medical advice. Always consult a qualified doctor.',
        pw / 2, 290, { align: 'center' }
      );
      doc.text(`Page ${p} of ${totalPages}`, pw / 2, 295, { align: 'center' });
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    const fileName = `swasth-health-plan-${this.disease.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    doc.save(fileName);

    } finally {
      // Always run inside Angular zone so change detection fires,
      // regardless of whether doc.save() threw or succeeded.
      this.ngZone.run(() => { this.isDownloading = false; });
    }
  }
}
