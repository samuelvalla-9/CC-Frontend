import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { Notification } from '../../models/notification.model';

@Component({
  selector: 'app-navbar',
  imports: [AsyncPipe, CommonModule, DatePipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  user$;
  isDarkMode = false;
  @Input() unreadCount = 0;
  @Input() notifications: Notification[] = [];
  @Output() markRead = new EventEmitter<number>();
  @Output() markAllRead = new EventEmitter<void>();
  showNotifPanel = false;

  constructor(public auth: AuthService, private router: Router) {
    this.user$ = this.auth.user$;
    this.isDarkMode = localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (this.isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  toggleNotifPanel() {
    this.showNotifPanel = !this.showNotifPanel;
  }

  closeNotifPanel() {
    this.showNotifPanel = false;
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }
  logout() { this.auth.logout(); }
}
