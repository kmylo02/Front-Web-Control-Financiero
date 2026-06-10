import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { IncomesService } from '../../core/services/incomes.service';
import { CategoriesService } from '../../core/services/categories.service';
import { Income, Category, MONTH_NAMES } from '../../core/models';

@Component({
  selector: 'app-incomes',
  templateUrl: './incomes.component.html',
  styleUrls: ['../expenses/expenses.component.scss'],
  imports: [NgIf, NgFor, DatePipe, ReactiveFormsModule],
})
export class IncomesComponent implements OnInit {
  loading = true;
  incomes: Income[]     = [];
  categories: Category[] = [];
  showModal = false;
  editingId: string | null = null;
  saving = false;
  form!: FormGroup;

  today = new Date();
  year  = this.today.getFullYear();
  month = this.today.getMonth() + 1;

  get monthName() { return MONTH_NAMES[this.month - 1]; }
  get total()     { return this.incomes.reduce((s, i) => s + i.amount, 0); }

  constructor(
    private incomesService: IncomesService,
    private categoriesService: CategoriesService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    forkJoin({
      incomes:    this.incomesService.getAll(this.year, this.month),
      categories: this.categoriesService.getAll('income'),
    }).subscribe(({ incomes, categories }) => {
      this.incomes    = incomes;
      this.categories = categories;
      this.loading    = false;
    });
  }

  private buildForm(inc?: Income): void {
    const dateStr = inc?.date
      ? new Date(inc.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    this.form = this.fb.group({
      amount:      [inc?.amount ?? '', [Validators.required, Validators.min(1)]],
      description: [inc?.description ?? '', Validators.required],
      date:        [dateStr, Validators.required],
      categoryId:  [typeof inc?.categoryId === 'object' ? (inc.categoryId as any)._id : (inc?.categoryId ?? ''), Validators.required],
      notes:       [inc?.notes ?? ''],
    });
  }

  changeMonth(dir: number): void {
    this.month += dir;
    if (this.month > 12) { this.month = 1; this.year++; }
    if (this.month < 1)  { this.month = 12; this.year--; }
    this.loadIncomes();
  }

  loadIncomes(): void {
    this.loading = true;
    this.incomesService.getAll(this.year, this.month).subscribe(data => { this.incomes = data; this.loading = false; });
  }

  openNew(): void    { this.editingId = null; this.buildForm(); this.showModal = true; }
  openEdit(i: Income): void { this.editingId = i._id; this.buildForm(i); this.showModal = true; }
  closeModal(): void { this.showModal = false; }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const data = { ...this.form.value, amount: +this.form.value.amount };
    const call = this.editingId
      ? this.incomesService.update(this.editingId, data)
      : this.incomesService.create(data);
    call.subscribe({ next: () => { this.showModal = false; this.saving = false; this.loadIncomes(); }, error: () => { this.saving = false; } });
  }

  delete(id: string): void {
    if (!confirm('¿Eliminar este ingreso?')) return;
    this.incomesService.delete(id).subscribe(() => this.loadIncomes());
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
}
