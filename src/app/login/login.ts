import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  isRegister = false;
  email = '';
  password = '';
  name = '';
  role = 'CITIZEN';
  error = '';
  loading = false;

  roles = ['CITIZEN'];

  constructor(private auth: AuthService) {}

  onSubmit() {
    this.error = '';
    this.loading = true;
    if (this.isRegister) {
      this.auth.register({ name: this.name, email: this.email, password: this.password, role: this.role })
        .subscribe({ next: () => this.auth.redirectByRole(), error: e => { this.error = e.error?.message || 'Registration failed'; this.loading = false; } });
    } else {
      this.auth.login(this.email, this.password)
        .subscribe({ next: () => this.auth.redirectByRole(), error: e => { this.error = e.error?.message || 'Invalid credentials'; this.loading = false; } });
    }
  }
}
