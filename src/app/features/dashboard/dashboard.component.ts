import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { Chart, registerables } from 'chart.js';
import { ReportsService } from '../../core/services/reports.service';
import { ExpensesService } from '../../core/services/expenses.service';
import { IncomesService } from '../../core/services/incomes.service';
import { RecurringService } from '../../core/services/recurring.service';
import { MonthlySummary, Expense, Income, Recurring, MONTH_NAMES } from '../../core/models';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [NgIf, NgFor, RouterLink, DatePipe, BaseChartDirective],
})
export class DashboardComponent implements OnInit {
  loading = true;
  today  = new Date();
  year   = this.today.getFullYear();
  month  = this.today.getMonth() + 1;
  monthName = MONTH_NAMES[this.month - 1];

  summary: MonthlySummary | null = null;
  recentExpenses: Expense[]  = [];
  recentIncomes:  Income[]   = [];
  pendingRecurring: Recurring[] = [];

  donutData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  donutOptions: ChartOptions<'doughnut'> = {
    responsive: true, cutout: '65%',
    plugins: { legend: { position: 'right' } },
  };

  barData: ChartData<'bar'> = { labels: [], datasets: [] };
  barOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true } },
  };

  constructor(
    private reportsService: ReportsService,
    private expensesService: ExpensesService,
    private incomesService: IncomesService,
    private recurringService: RecurringService,
  ) {}

  ngOnInit(): void {
    forkJoin({
      summary:  this.reportsService.getMonthly(this.year, this.month),
      expenses: this.expensesService.getAll(this.year, this.month),
      incomes:  this.incomesService.getAll(this.year, this.month),
      pending:  this.recurringService.getPending(),
      yearly:   this.reportsService.getYearly(this.year),
    }).subscribe({
      next: ({ summary, expenses, incomes, pending, yearly }) => {
        this.summary          = summary;
        this.recentExpenses   = expenses.slice(0, 5);
        this.recentIncomes    = incomes.slice(0, 5);
        this.pendingRecurring = pending;

        if (summary.byCategory?.length) {
          this.donutData = {
            labels: summary.byCategory.map((c: any) => c.category?.name ?? 'Sin categoría'),
            datasets: [{
              data: summary.byCategory.map((c: any) => c.total),
              backgroundColor: summary.byCategory.map((c: any) => c.category?.color ?? '#6366f1'),
              borderWidth: 2,
            }],
          };
        }

        this.barData = {
          labels: MONTH_NAMES.map(m => m.substring(0, 3)),
          datasets: [
            { label: 'Gastos', data: yearly.months.map(m => m.expenses), backgroundColor: '#ef4444', borderRadius: 4 },
            { label: 'Ingresos', data: yearly.months.map(m => m.incomes), backgroundColor: '#22c55e', borderRadius: 4 },
          ],
        };
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
  getCategoryName(exp: Expense): string  { return typeof exp.categoryId === 'object' ? (exp.categoryId as any).name : ''; }
  getCategoryColor(exp: Expense): string { return typeof exp.categoryId === 'object' ? (exp.categoryId as any).color : '#6366f1'; }
  get usagePercent(): number { return this.summary?.budget?.usagePercent ?? 0; }
  get usageClass(): string   { return this.usagePercent >= 100 ? 'danger' : this.usagePercent >= 80 ? 'warning' : ''; }
}
