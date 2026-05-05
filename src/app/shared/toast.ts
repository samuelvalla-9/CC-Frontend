import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  imports: [AsyncPipe],
  template: `
    <div class="toast-container">
      @for (toast of toasts$ | async; track toast.id) {
        <div class="toast" [class]="toast.type" (click)="close(toast.id)">
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
      flex-direction: column-reverse;
      gap: 12px;
      max-width: 400px;
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
      animation: slideIn 0.3s ease-out;
      font-size: 14px;
      font-weight: 500;
      min-width: 320px;
      pointer-events: auto;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
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
}
