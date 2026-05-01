import {
  Component, Input, OnDestroy,
  ElementRef, ViewChild, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

interface Facility {
  id:       number;
  name:     string;
  lat:      number;
  lon:      number;
  type:     'hospital' | 'clinic' | 'pharmacy';
  distance: number;   // km
}

/** Diseases that warrant showing hospitals first (over clinics/pharmacies). */
const SERIOUS_DISEASES = new Set([
  'heart attack', 'myocardial infarction', 'stroke', 'pneumonia',
  'pulmonary embolism', 'meningitis', 'sepsis', 'cardiac arrest',
  'aneurysm', 'appendicitis', 'kidney failure', 'liver failure',
  'diabetic ketoacidosis', 'hypertensive crisis', 'paralysis',
  'jaundice', 'chronic cholestasis', 'hepatitis', 'tuberculosis',
]);

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Component({
  selector:    'app-nearby-facilities',
  standalone:  true,
  imports:     [CommonModule],
  templateUrl: './nearby-facilities.html',
  styleUrl:    './nearby-facilities.scss',
})
export class NearbyFacilitiesComponent implements OnDestroy {

  @Input() disease:    string = '';
  @Input() confidence: number = 0;

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  // ── state ────────────────────────────────────────────────────────────────
  state: 'idle' | 'locating' | 'loading' | 'ready' | 'error' = 'idle';
  errorMsg  = '';
  facilities: Facility[] = [];

  private map: any = null;   // Leaflet Map instance

  constructor(private cdr: ChangeDetectorRef) {}

  // ── public ────────────────────────────────────────────────────────────────
  get isSerious(): boolean {
    return SERIOUS_DISEASES.has(this.disease.toLowerCase());
  }

  get facilityLabel(): string {
    return this.isSerious
      ? 'Nearby Hospitals & Clinics'
      : 'Nearby Clinics & Pharmacies';
  }

  get buttonLabel(): string {
    return this.isSerious
      ? '🏥 Find Nearby Hospitals'
      : '📍 Find Nearby Clinics & Pharmacies';
  }

  // ── entry point ───────────────────────────────────────────────────────────
  async showMap(): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'error') return;

    this.state    = 'locating';
    this.errorMsg = '';
    this.cdr.detectChanges();

    try {
      const pos = await this.getUserLocation();
      const { lat, lon } = pos;

      this.state = 'loading';
      this.cdr.detectChanges();

      const raw = await this.fetchOverpass(lat, lon);
      this.facilities = this.parseFacilities(raw, lat, lon);

      this.state = 'ready';
      this.cdr.detectChanges();

      // wait one tick so *ngIf renders the map div
      setTimeout(() => this.initMap(lat, lon), 50);

    } catch (err: any) {
      this.state    = 'error';
      this.errorMsg = err.message ?? 'Something went wrong.';
      this.cdr.detectChanges();
    }
  }

  // ── geolocation ───────────────────────────────────────────────────────────
  private getUserLocation(): Promise<{ lat: number; lon: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        err => {
          const msgs: Record<number, string> = {
            1: 'Location permission denied. Please allow location access and try again.',
            2: 'Could not determine your location. Please try again.',
            3: 'Location request timed out. Please try again.',
          };
          reject(new Error(msgs[err.code] ?? 'Location error.'));
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  // ── overpass query ────────────────────────────────────────────────────────
  private async fetchOverpass(lat: number, lon: number): Promise<any> {
    const r  = 5000;   // 5 km radius
    const query = `
[out:json][timeout:15];
(
  node["amenity"="hospital"](around:${r},${lat},${lon});
  way["amenity"="hospital"](around:${r},${lat},${lon});
  node["amenity"="clinic"](around:${r},${lat},${lon});
  way["amenity"="clinic"](around:${r},${lat},${lon});
  node["amenity"="pharmacy"](around:3000,${lat},${lon});
  way["amenity"="pharmacy"](around:3000,${lat},${lon});
);
out center 20;
    `.trim();

    const url  = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Could not reach the map data service. Please try again later.');
    return resp.json();
  }

  // ── parse results ─────────────────────────────────────────────────────────
  private parseFacilities(data: any, userLat: number, userLon: number): Facility[] {
    const amenityType: Record<string, Facility['type']> = {
      hospital: 'hospital',
      clinic:   'clinic',
      pharmacy: 'pharmacy',
    };

    const result: Facility[] = [];

    for (const el of (data.elements ?? [])) {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (!lat || !lon) continue;

      const amenity = el.tags?.amenity as string;
      const type    = amenityType[amenity];
      if (!type) continue;

      const name = el.tags?.name
        ?? el.tags?.['name:en']
        ?? (type === 'hospital' ? 'Hospital' : type === 'clinic' ? 'Clinic' : 'Pharmacy');

      result.push({
        id:       el.id,
        name,
        lat,
        lon,
        type,
        distance: haversineKm(userLat, userLon, lat, lon),
      });
    }

    // sort: serious → hospitals first; otherwise clinics first, then pharmacies
    const order: Record<Facility['type'], number> = this.isSerious
      ? { hospital: 0, clinic: 1, pharmacy: 2 }
      : { clinic: 0, pharmacy: 1, hospital: 2 };

    return result
      .sort((a, b) => order[a.type] - order[b.type] || a.distance - b.distance)
      .slice(0, 15);
  }

  // ── leaflet map ───────────────────────────────────────────────────────────
  private async initMap(userLat: number, userLon: number): Promise<void> {

    const container = this.mapContainer?.nativeElement;
    if (!container) return;

    // destroy previous instance if any
    if (this.map) { this.map.remove(); this.map = null; }

    this.map = L.map(container, { zoomControl: true }).setView([userLat, userLon], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    // user marker — pulsing blue dot via divIcon
    const userIcon = L.divIcon({
      className: '',
      html: '<div class="user-marker"></div>',
      iconSize:   [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([userLat, userLon], { icon: userIcon })
      .addTo(this.map)
      .bindPopup('<strong>You are here</strong>');

    // facility markers
    const icons: Record<Facility['type'], string> = {
      hospital: '#ef4444',   // red
      clinic:   '#22c55e',   // green
      pharmacy: '#3b82f6',   // blue
    };

    const labels: Record<Facility['type'], string> = {
      hospital: '🏥',
      clinic:   '🏨',
      pharmacy: '💊',
    };

    for (const f of this.facilities) {
      const icon = L.divIcon({
        className: '',
        html: `<div class="facility-marker" style="background:${icons[f.type]}">${labels[f.type]}</div>`,
        iconSize:   [32, 32],
        iconAnchor: [16, 32],
        popupAnchor:[0, -32],
      });

      L.marker([f.lat, f.lon], { icon })
        .addTo(this.map)
        .bindPopup(
          `<div class="map-popup">
            <strong>${f.name}</strong><br>
            <span class="popup-type">${f.type.charAt(0).toUpperCase() + f.type.slice(1)}</span>
            &nbsp;·&nbsp;
            <span class="popup-dist">${f.distance.toFixed(1)} km away</span>
          </div>`
        );
    }
  }

  // ── cleanup ───────────────────────────────────────────────────────────────
  ngOnDestroy(): void {
    if (this.map) { this.map.remove(); this.map = null; }
  }

  // ── helpers for template ──────────────────────────────────────────────────
  facilityIcon(type: Facility['type']): string {
    return { hospital: '🏥', clinic: '🏨', pharmacy: '💊' }[type];
  }

  facilityColor(type: Facility['type']): string {
    return { hospital: '#ef4444', clinic: '#22c55e', pharmacy: '#3b82f6' }[type];
  }
}
