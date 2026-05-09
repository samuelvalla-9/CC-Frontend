import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  imports: [AsyncPipe],
  template: `
    <div class="toast-container">
      @for (toast of toasts$ | async; track toast.id; let i = $index, count = $count) {
        <div class="toast" [class]="toast.type" (click)="close(toast.id)"
             [style.filter]="getBlur(i, count)"
             [style.opacity]="getOpacity(i, count)"
             [style.transform]="getTransform(i, count)"
             [style.pointer-events]="getPointerEvents(i, count)">
          <span class="toast-icon">
            @if (toast.type === 'error') { ❌ }
            @if (toast.type === 'success') { ✅ }
            @if (toast.type === 'warning') { ⚠️ }
            @if (toast.type === 'info') { ℹ️ }
          </span>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" (click)="close(toast.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 12px;
      max-width: 400px;
      max-height: 50vh;
      overflow: visible;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      animation: slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      font-size: 14px;
      font-weight: 500;
      min-width: 320px;
      pointer-events: auto;
      transition: filter 0.4s ease, opacity 0.4s ease, transform 0.4s ease;
    }

    @keyframes slideUp {
      from {
        transform: translateY(80px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .toast.error {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: white;
      border-left: 4px solid #7f1d1d;
    }

    .toast.success {
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
      color: white;
      border-left: 4px solid #14532d;
    }

    .toast.warning {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      border-left: 4px solid #92400e;
    }

    .toast.info {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border-left: 4px solid #1e40af;
    }

    .toast-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
      line-height: 1.4;
    }

    .toast-close {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .toast-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  `]
})
export class ToastComponent {
  toasts$;

  constructor(private toastService: ToastService) {
    this.toasts$ = this.toastService.getToasts();
  }

  close(id: number) {
    this.toastService.remove(id);
  }

  /**
   * Oldest toast = index 0 (top of stack, blurred).
   * Newest toast = index count-1 (bottom of stack, crisp).
   * "age" = how far from the bottom (newest).
   */
  private age(index: number, count: number): number {
    return count - 1 - index;
  }

  getBlur(index: number, count: number): string {
    const a = this.age(index, count);
    if (a <= 1) return 'none';
    const blur = Math.min((a - 1) * 2.5, 12);
    return `blur(${blur}px)`;
  }

  getOpacity(index: number, count: number): number {
    const a = this.age(index, count);
    if (a <= 1) return 1;
    // Fade older toasts; invisible by ~8th toast
    return Math.max(1 - (a - 1) * 0.15, 0);
  }

  getTransform(index: number, count: number): string {
    const a = this.age(index, count);
    if (a <= 1) return 'none';
    const scale = Math.max(1 - a * 0.02, 0.85);
    return `scale(${scale})`;
  }

  getPointerEvents(index: number, count: number): string {
    // Disable interaction on fully faded toasts
    return this.getOpacity(index, count) <= 0 ? 'none' : 'auto';
  }
}
