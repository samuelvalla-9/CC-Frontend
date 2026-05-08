import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading',
  standalone: true,
  template: `
    @if (loading) {
      <div class="loading-container" [class]="variant">
        @if (variant === 'table') {
          <div class="skeleton-table">
            <div class="skeleton-row header"></div>
            @for (i of rows; track i) {
              <div class="skeleton-row"></div>
            }
          </div>
        } @else if (variant === 'cards') {
          <div class="skeleton-cards">
            @for (i of [1,2,3,4]; track i) {
              <div class="skeleton-card"></div>
            }
          </div>
        } @else {
          <div class="skeleton-spinner">
            <div class="spinner"></div>
            <p>Loading...</p>
          </div>
        }
      </div>
    } @else {
      <ng-content></ng-content>
    }
  `,
  styles: [`
    .loading-container { padding: 1rem 0; }
    .skeleton-row {
      height: 40px;
      background: linear-gradient(90deg, var(--gray-100) 25%, var(--gray-200) 50%, var(--gray-100) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .skeleton-row.header { height: 36px; opacity: 0.7; }
    .skeleton-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .skeleton-card {
      height: 100px;
      background: linear-gradient(90deg, var(--gray-100) 25%, var(--gray-200) 50%, var(--gray-100) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 8px;
    }
    .skeleton-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      gap: 0.75rem;
    }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid var(--gray-200);
      border-top-color: var(--brand-blue);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .skeleton-spinner p { color: var(--gray-400); font-size: 0.875rem; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class LoadingComponent {
  @Input() loading = false;
  @Input() variant: 'table' | 'cards' | 'spinner' = 'spinner';
  @Input() rowCount = 5;

  get rows() { return Array.from({ length: this.rowCount }, (_, i) => i); }
}

