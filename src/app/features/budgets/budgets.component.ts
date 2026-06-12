import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { BudgetsService } from '../../core/services/budgets.service';
import { ReportsService } from '../../core/services/reports.service';
import { DialogService } from '../../core/services/dialog.service';
import { Budget, MonthlySummary, MONTH_NAMES } from '../../core/models';

@Component({
  selector: 'app-budgets',
  templateUrl: './budgets.component.html',
  styleUrls: ['./budgets.component.scss'],
  imports: [NgIf, NgFor, ReactiveFormsModule],
})
export class BudgetsComponent implements OnInit {
  loading = true;
  saving  = false;
  today   = new Date();
  year    = this.today.getFullYear();
  month   = this.today.getMonth() + 1;
  monthName = MONTH_NAMES[this.month - 1];

  budget:  Budget | null       = null;
  summary: MonthlySummary | null = null;
  form!: FormGroup;

  constructor(
    private budgetsService: BudgetsService,
    private reportsService: ReportsService,
    private dialog: DialogService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void { this.buildForm(); this.load(); }

  private buildForm(b?: Budget): void {
    this.form = this.fb.group({ totalLimit: [b?.totalLimit ?? '', [Validators.required, Validators.min(1)]] });
  }

  load(): void {
    this.loading = true;
    this.reportsService.getMonthly(this.year, this.month).subscribe(summary => {
      this.summary = summary;
      this.budget  = summary.budget?.budget ?? null;
      if (this.budget) this.buildForm(this.budget);
      this.loading = false;
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    this.budgetsService.upsert({ year: this.year, month: this.month, totalLimit: +this.form.value.totalLimit }).subscribe({
      next: () => { this.saving = false; this.load(); },
      error: () => { this.saving = false; },
    });
  }

  async deleteBudget(): Promise<void> {
    const ok = await this.dialog.confirm('¿Eliminar presupuesto?', 'Se eliminará el presupuesto de este mes.');
    if (!ok) return;
    this.budgetsService.delete(this.year, this.month).subscribe(() => this.load());
  }

  get usagePercent(): number { return this.summary?.budget?.usagePercent ?? 0; }
  get usageClass(): string   { return this.usagePercent >= 100 ? 'danger' : this.usagePercent >= 80 ? 'warning' : ''; }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
}
