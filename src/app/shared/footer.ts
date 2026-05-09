import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="app-footer">
      <div class="footer-content">
        <div class="footer-brand">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span>CityCare Enterprise Platform</span>
        </div>
        <div class="footer-info">
          <span class="footer-version">v2.1.0</span>
          <span class="footer-separator">•</span>
          <span>{{ currentYear }} City Healthcare Authority</span>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .app-footer {
      background: white;
      border-top: 1px solid var(--gray-200);
      padding: 12px 24px;
      font-size: 0.75rem;
      color: var(--gray-500);
      position: relative;
      z-index: 1;
    }
    .footer-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 100%;
    }
    .footer-brand {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      color: var(--gray-600);
    }
    .footer-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .footer-separator { color: var(--gray-300); }
    .footer-version {
      background: var(--gray-100);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      font-family: monospace;
    }
    .footer-env {
      background: #dcfce7;
      color: #166534;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    :host-context([data-theme="dark"]) .app-footer {
      background: var(--gray-100);
      border-top-color: var(--gray-200);
    }
    :host-context([data-theme="dark"]) .footer-version { background: var(--gray-200); }
    :host-context([data-theme="dark"]) .footer-env { background: #14532d; color: #86efac; }

    @media (max-width: 768px) {
      .footer-content { flex-direction: column; gap: 4px; }
    }
  `]
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  constructor(private auth: AuthService) {}
}

