import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ReportsService } from '../../core/services/reports.service';
import { ExpensesService } from '../../core/services/expenses.service';
import { IncomesService } from '../../core/services/incomes.service';
import { RecurringService } from '../../core/services/recurring.service';
import { BillItemsService } from '../../core/services/bill-items.service';
import { MonthlySummary, Expense, Income, Recurring, BillItem, MONTH_NAMES } from '../../core/models';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [NgIf, NgFor, RouterLink, DatePipe],
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('donutCanvas', { static: false }) donutCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas',   { static: false }) barCanvasRef?:   ElementRef<HTMLCanvasElement>;

  loading = true;
  today     = new Date();
  year      = this.today.getFullYear();
  month     = this.today.getMonth() + 1;
  monthName = MONTH_NAMES[this.month - 1];

  summary:          MonthlySummary | null = null;
  recentExpenses:   Expense[]   = [];
  recentIncomes:    Income[]    = [];
  pendingRecurring: Recurring[] = [];
  agendaBills:      BillItem[]  = [];

  get agendaPending()      { return this.agendaBills.filter(b => b.status === 'pending'); }
  get agendaPaid()         { return this.agendaBills.filter(b => b.status === 'paid'); }
  get agendaTotalPending() { return this.agendaPending.reduce((s, b) => s + b.amount, 0); }
  get agendaTotalPaid()    { return this.agendaPaid.reduce((s, b) => s + b.amount, 0); }
  get agendaTotal()        { return this.agendaBills.reduce((s, b) => s + b.amount, 0); }
  get agendaPercent()      { return this.agendaTotal > 0 ? Math.round((this.agendaTotalPaid / this.agendaTotal) * 100) : 0; }

  // Balance combinado: gastos regulares + agenda pagada
  get totalGastado()      { return (this.summary?.totalExpenses ?? 0) + this.agendaTotalPaid; }
  get balance()           { return (this.summary?.totalIncomes ?? 0) - this.totalGastado; }
  get balanceProyectado() { return this.balance - this.agendaTotalPending; }

  get agendaSorted(): BillItem[] {
    const pending = this.agendaPending.slice().sort((a, b) => a.dueDay - b.dueDay);
    const paid    = this.agendaPaid.slice().sort((a, b) => a.dueDay - b.dueDay);
    return [...pending, ...paid];
  }

  isOverdue(bill: BillItem): boolean {
    return bill.status === 'pending'
      && this.year === this.today.getFullYear()
      && this.month === this.today.getMonth() + 1
      && bill.dueDay < this.today.getDate();
  }

  isDueToday(bill: BillItem): boolean {
    return bill.status === 'pending'
      && this.year === this.today.getFullYear()
      && this.month === this.today.getMonth() + 1
      && bill.dueDay === this.today.getDate();
  }

  private donutChart?: Chart;
  private barChart?:   Chart;

  constructor(
    private reportsService:  ReportsService,
    private expensesService: ExpensesService,
    private incomesService:  IncomesService,
    private recurringService: RecurringService,
    private billItemsService: BillItemsService,
  ) {}

  ngOnInit(): void {
    forkJoin({
      summary:  this.reportsService.getMonthly(this.year, this.month),
      expenses: this.expensesService.getAll(this.year, this.month),
      incomes:  this.incomesService.getAll(this.year, this.month),
      pending:  this.recurringService.getPending(),
      yearly:   this.reportsService.getYearly(this.year),
      bills:    this.billItemsService.getByMonth(this.year, this.month),
    }).subscribe({
      next: ({ summary, expenses, incomes, pending, yearly, bills }) => {
        this.summary          = summary;
        this.recentExpenses   = expenses.slice(0, 5);
        this.recentIncomes    = incomes.slice(0, 5);
        this.pendingRecurring = pending;
        this.agendaBills      = bills;
        this.loading = false;

        // Let Angular render the *ngIf blocks before drawing charts
        setTimeout(() => {
          this.renderDonut(summary);
          this.renderBar(yearly);
        }, 0);
      },
      error: () => { this.loading = false; },
    });
  }

  ngOnDestroy(): void {
    this.donutChart?.destroy();
    this.barChart?.destroy();
  }

  private renderDonut(summary: MonthlySummary): void {
    if (!this.donutCanvasRef || !summary.byCategory?.length) return;
    this.donutChart?.destroy();
    this.donutChart = new Chart(this.donutCanvasRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels:   summary.byCategory.map((c: any) => c.category?.name ?? 'Sin categoría'),
        datasets: [{
          data:            summary.byCategory.map((c: any) => c.total),
          backgroundColor: summary.byCategory.map((c: any) => c.category?.color ?? '#6366f1'),
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: { legend: { position: 'right' } },
      },
    });
  }

  private renderBar(yearly: any): void {
    if (!this.barCanvasRef) return;
    this.barChart?.destroy();
    this.barChart = new Chart(this.barCanvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels:   MONTH_NAMES.map(m => m.substring(0, 3)),
        datasets: [
          { label: 'Gastos',   data: yearly.months.map((m: any) => m.expenses), backgroundColor: '#ef4444', borderRadius: 4 },
          { label: 'Ingresos', data: yearly.months.map((m: any) => m.incomes),  backgroundColor: '#22c55e', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  toggleBill(bill: BillItem): void {
    this.billItemsService.toggle(bill._id).subscribe(() => {
      this.billItemsService.getByMonth(this.year, this.month)
        .subscribe(bills => { this.agendaBills = bills; });
    });
  }

  billCatColor(b: BillItem): string { return typeof b.categoryId === 'object' ? (b.categoryId as any).color : '#6366f1'; }
  billCatName(b: BillItem): string  { return typeof b.categoryId === 'object' ? (b.categoryId as any).name  : ''; }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
  getCategoryName(exp: Expense):  string { return typeof exp.categoryId === 'object' ? (exp.categoryId as any).name  : ''; }
  getCategoryColor(exp: Expense): string { return typeof exp.categoryId === 'object' ? (exp.categoryId as any).color : '#6366f1'; }
  get usagePercent(): number { return this.summary?.budget?.usagePercent ?? 0; }
  get usageClass():   string { return this.usagePercent >= 100 ? 'danger' : this.usagePercent >= 80 ? 'warning' : ''; }
}
