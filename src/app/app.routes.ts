import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { LayoutComponent } from './layout/layout.component';

export const APP_ROUTES: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'expenses',
        loadComponent: () => import('./features/expenses/expenses.component').then(m => m.ExpensesComponent),
      },
      {
        path: 'incomes',
        loadComponent: () => import('./features/incomes/incomes.component').then(m => m.IncomesComponent),
      },
      {
        path: 'recurring',
        loadComponent: () => import('./features/recurring/recurring.component').then(m => m.RecurringComponent),
      },
      {
        path: 'budgets',
        loadComponent: () => import('./features/budgets/budgets.component').then(m => m.BudgetsComponent),
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent),
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/categories.component').then(m => m.CategoriesComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
