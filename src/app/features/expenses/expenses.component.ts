import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ExpensesService } from '../../core/services/expenses.service';
import { CategoriesService } from '../../core/services/categories.service';
import { Expense, Category, MONTH_NAMES } from '../../core/models';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss'],
  imports: [NgIf, NgFor, DatePipe, ReactiveFormsModule],
})
export class ExpensesComponent implements OnInit {
  loading = true;
  expenses: Expense[]   = [];
  categories: Category[] = [];
  showModal    = false;
  editingId: string | null = null;
  saving       = false;
  showQuickCat = false;
  form!: FormGroup;

  today = new Date();
  year  = this.today.getFullYear();
  month = this.today.getMonth() + 1;

  get monthName() { return MONTH_NAMES[this.month - 1]; }
  get total()     { return this.expenses.reduce((s, e) => s + e.amount, 0); }

  constructor(
    private expensesService: ExpensesService,
    private categoriesService: CategoriesService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    forkJoin({
      expenses:   this.expensesService.getAll(this.year, this.month),
      categories: this.categoriesService.getAll('expense'),
    }).subscribe(({ expenses, categories }) => {
      this.expenses   = expenses;
      this.categories = categories;
      this.loading    = false;
    });
  }

  private buildForm(exp?: Expense): void {
    const dateStr = exp?.date
      ? new Date(exp.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    this.form = this.fb.group({
      amount:      [exp?.amount ?? '', [Validators.required, Validators.min(1)]],
      description: [exp?.description ?? '', Validators.required],
      date:        [dateStr, Validators.required],
      categoryId:  [typeof exp?.categoryId === 'object' ? (exp.categoryId as any)._id : (exp?.categoryId ?? ''), Validators.required],
      notes:       [exp?.notes ?? ''],
    });
  }

  changeMonth(dir: number): void {
    this.month += dir;
    if (this.month > 12) { this.month = 1; this.year++; }
    if (this.month < 1)  { this.month = 12; this.year--; }
    this.loadExpenses();
  }

  loadExpenses(): void {
    this.loading = true;
    this.expensesService.getAll(this.year, this.month).subscribe(data => { this.expenses = data; this.loading = false; });
  }

  openNew(): void    { this.editingId = null; this.buildForm(); this.showQuickCat = false; this.showModal = true; }
  openEdit(e: Expense): void { this.editingId = e._id; this.buildForm(e); this.showQuickCat = false; this.showModal = true; }
  closeModal(): void { this.showModal = false; this.showQuickCat = false; }
  toggleQuickCat(): void { this.showQuickCat = !this.showQuickCat; }
  createQuickCat(name: string, input: HTMLInputElement): void {
    if (!name.trim()) return;
    this.categoriesService.create({ name: name.trim(), type: 'expense', color: '#6366f1', icon: 'receipt' })
      .subscribe({ next: (cat) => { this.categories = [...this.categories, cat]; this.form.patchValue({ categoryId: cat._id }); this.showQuickCat = false; input.value = ''; } });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const data = { ...this.form.value, amount: +this.form.value.amount };
    const call = this.editingId
      ? this.expensesService.update(this.editingId, data)
      : this.expensesService.create(data);
    call.subscribe({ next: () => { this.showModal = false; this.saving = false; this.loadExpenses(); }, error: () => { this.saving = false; } });
  }

  delete(id: string): void {
    if (!confirm('¿Eliminar este gasto?')) return;
    this.expensesService.delete(id).subscribe(() => this.loadExpenses());
  }

  getCatName(exp: Expense): string  { return typeof exp.categoryId === 'object' ? (exp.categoryId as any).name : ''; }
  getCatColor(exp: Expense): string { return typeof exp.categoryId === 'object' ? (exp.categoryId as any).color : '#6366f1'; }
  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
}
