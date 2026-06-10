import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { Chart, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';
import { ReportsService } from '../../core/services/reports.service';
import { YearlySummary, MonthComparison, MONTH_NAMES } from '../../core/models';

Chart.register(...registerables);

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  imports: [NgIf, NgFor, BaseChartDirective],
})
export class ReportsComponent implements OnInit {
  loading = true;
  today = new Date();
  year  = this.today.getFullYear();
  month = this.today.getMonth() + 1;
  monthName = MONTH_NAMES[this.month - 1];

  yearly:     YearlySummary   | null = null;
  comparison: MonthComparison | null = null;
  yearComp: any = null;

  lineData: ChartData<'line'> = { labels: [], datasets: [] };
  lineOptions: ChartOptions<'line'> = {
    responsive: true, plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true } },
  };
  barData: ChartData<'bar'> = { labels: [], datasets: [] };
  barOptions: ChartOptions<'bar'> = {
    responsive: true, plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true } },
  };

  constructor(private reportsService: ReportsService) {}

  ngOnInit(): void {
    forkJoin({
      yearly:     this.reportsService.getYearly(this.year),
      comparison: this.reportsService.compareMonths(this.year, this.month),
      yearComp:   this.reportsService.yearComparison(this.year),
    }).subscribe({
      next: ({ yearly, comparison, yearComp }) => {
        this.yearly = yearly; this.comparison = comparison; this.yearComp = yearComp;
        this.buildCharts(yearly, yearComp);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  private buildCharts(yearly: YearlySummary, yearComp: any): void {
    const labels = MONTH_NAMES.map(m => m.substring(0, 3));
    this.lineData = {
      labels,
      datasets: [{ label: 'Balance ' + this.year, data: yearly.months.map(m => m.balance),
        borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.1)', fill: true, tension: 0.4, pointRadius: 4 }],
    };
    if (yearComp?.previousYear) {
      this.barData = {
        labels,
        datasets: [
          { label: `Gastos ${this.year}`, data: yearly.months.map(m => m.expenses), backgroundColor: '#ef4444', borderRadius: 4 },
          { label: `Gastos ${this.year - 1}`, data: yearComp.previousYear.months.map((m: any) => m.expenses), backgroundColor: '#fca5a5', borderRadius: 4 },
        ],
      };
    }
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }
  changeSign(v: number | null): string { if (v === null) return 'N/A'; return (v > 0 ? '+' : '') + v + '%'; }
  changeClass(v: number | null, inv = false): string {
    if (v === null) return ''; const pos = inv ? v < 0 : v > 0; return pos ? 'text-success' : 'text-danger';
  }
}
