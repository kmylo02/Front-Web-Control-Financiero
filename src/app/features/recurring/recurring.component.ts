import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { RecurringService } from '../../core/services/recurring.service';
import { CategoriesService } from '../../core/services/categories.service';
import { Recurring, Category } from '../../core/models';

@Component({
  selector: 'app-recurring',
  templateUrl: './recurring.component.html',
  styleUrls: ['./recurring.component.scss'],
  imports: [NgIf, NgFor, ReactiveFormsModule],
})
export class RecurringComponent implements OnInit {
  loading = true;
  recurrents: Recurring[]  = [];
  pending:    Recurring[]  = [];
  categories: Category[]   = [];
  showModal = false;
  editingId: string | null = null;
  saving = false;
  activatingId: string | null = null;
  form!: FormGroup;

  readonly modes = [
    { value: 'auto',     label: 'Automático', desc: 'Se genera solo el día 1 de cada mes' },
    { value: 'manual',   label: 'Manual',      desc: 'Tú lo confirmas cada mes' },
    { value: 'template', label: 'Plantilla',   desc: 'Copias y ajustas el monto cada mes' },
  ];

  constructor(
    private recurringService: RecurringService,
    private categoriesService: CategoriesService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    forkJoin({
      all:     this.recurringService.getAll(),
      pending: this.recurringService.getPending(),
      cats:    this.categoriesService.getAll(),
    }).subscribe(({ all, pending, cats }) => {
      this.recurrents = all; this.pending = pending; this.categories = cats; this.loading = false;
    });
  }

  private buildForm(rec?: Recurring): void {
    this.form = this.fb.group({
      name:       [rec?.name ?? '', Validators.required],
      amount:     [rec?.amount ?? '', [Validators.required, Validators.min(1)]],
      categoryId: [typeof rec?.categoryId === 'object' ? (rec.categoryId as any)._id : (rec?.categoryId ?? ''), Validators.required],
      type:       [rec?.type ?? 'expense', Validators.required],
      mode:       [rec?.mode ?? 'manual', Validators.required],
      dayOfMonth: [rec?.dayOfMonth ?? 1, [Validators.required, Validators.min(1), Validators.max(28)]],
      isActive:   [rec?.isActive ?? true],
      notes:      [rec?.notes ?? ''],
    });
  }

  openNew(): void { this.editingId = null; this.buildForm(); this.showModal = true; }
  openEdit(r: Recurring): void { this.editingId = r._id; this.buildForm(r); this.showModal = true; }
  closeModal(): void { this.showModal = false; }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const data = { ...this.form.value, amount: +this.form.value.amount, dayOfMonth: +this.form.value.dayOfMonth };
    const call = this.editingId
      ? this.recurringService.update(this.editingId, data)
      : this.recurringService.create(data);
    call.subscribe({ next: () => { this.showModal = false; this.saving = false; this.reload(); }, error: () => { this.saving = false; } });
  }

  activate(id: string): void {
    this.activatingId = id;
    this.recurringService.activate(id).subscribe({
      next: () => { this.activatingId = null; this.reload(); },
      error: () => { this.activatingId = null; },
    });
  }

  delete(id: string): void {
    if (!confirm('¿Eliminar?')) return;
    this.recurringService.delete(id).subscribe(() => this.reload());
  }

  private reload(): void {
    forkJoin({ all: this.recurringService.getAll(), pending: this.recurringService.getPending() })
      .subscribe(({ all, pending }) => { this.recurrents = all; this.pending = pending; });
  }

  getCatName(r: Recurring): string { return typeof r.categoryId === 'object' ? (r.categoryId as any).name : ''; }
  modeLabel(mode: string): string  { return this.modes.find(m => m.value === mode)?.label ?? mode; }
  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
}
