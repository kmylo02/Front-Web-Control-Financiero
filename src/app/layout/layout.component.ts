import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { NotificationsService } from '../core/services/notifications.service';
import { User } from '../core/models';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, NgFor, NgIf],
})
export class LayoutComponent implements OnInit {
  user: User | null = null;
  sidebarOpen = true;
  unreadCount$!: Observable<number>;

  navItems = [
    { path: '/dashboard',  label: 'Dashboard',  icon: '📊' },
    { path: '/expenses',   label: 'Gastos',      icon: '💸' },
    { path: '/incomes',    label: 'Ingresos',    icon: '💵' },
    { path: '/recurring',  label: 'Recurrentes', icon: '🔄' },
    { path: '/budgets',    label: 'Presupuesto', icon: '🎯' },
    { path: '/reports',    label: 'Reportes',    icon: '📈' },
    { path: '/categories', label: 'Categorías',  icon: '🏷️' },
  ];

  constructor(
    private authService: AuthService,
    private notificationsService: NotificationsService,
  ) {}

  ngOnInit(): void {
    this.user         = this.authService.currentUser;
    this.unreadCount$ = this.notificationsService.unreadCount$;
    this.notificationsService.getUnreadCount().subscribe();
  }

  logout(): void      { this.authService.logout(); }
  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
}
