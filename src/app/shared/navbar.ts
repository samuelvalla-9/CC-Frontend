import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [AsyncPipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  user$;
  constructor(public auth: AuthService, private router: Router) {
    this.user$ = this.auth.user$;
  }
  logout() { this.auth.logout(); }
}
