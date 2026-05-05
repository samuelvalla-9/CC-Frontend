import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  template: '<router-outlet></router-outlet><app-toast></app-toast>',
})
export class App {}
