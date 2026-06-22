import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { IncomesService } from '../../core/services/incomes.service';
import { CategoriesService } from '../../core/services/categories.service';
import { DialogService } from '../../core/services/dialog.service';
import { Income, Category, MONTH_NAMES } from '../../core/models';

@Component({
  selector: 'app-incomes',
  templateUrl: './incomes.component.html',
  styleUrls: ['../expenses/expenses.component.scss'],
  imports: [NgIf, NgFor, DatePipe, ReactiveFormsModule, FormsModule],
})
export class IncomesComponent implements OnInit {
  loading = true;
  incomes: Income[]     = [];
  categories: Category[] = [];
  showModal    = false;
  editingId: string | null = null;
  saving       = false;
  showQuickCat = false;
  form!: FormGroup;

  searchText = '';
  sortBy: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' = 'date-desc';

  today = new Date();
  year  = this.today.getFullYear();
  month = this.today.getMonth() + 1;

  get monthName() { return MONTH_NAMES[this.month - 1]; }

  get filtered(): Income[] {
    let list = this.searchText.trim()
      ? this.incomes.filter(i => i.description.toLowerCase().includes(this.searchText.toLowerCase()))
      : [...this.incomes];
    switch (this.sortBy) {
      case 'date-desc':
        list.sort((a, b) => {
          const d = b.date.localeCompare(a.date);
          return d !== 0 ? d : (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
        }); break;
      case 'date-asc':
        list.sort((a, b) => {
          const d = a.date.localeCompare(b.date);
          return d !== 0 ? d : (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
        }); break;
      case 'amount-desc': list.sort((a, b) => b.amount - a.amount); break;
      case 'amount-asc':  list.sort((a, b) => a.amount - b.amount); break;
    }
    return list;
  }

  get total() { return this.filtered.reduce((s, i) => s + i.amount, 0); }

  constructor(
    private incomesService: IncomesService,
    private categoriesService: CategoriesService,
    private dialog: DialogService,
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

  get bankBalance(): { bank: string; total: number }[] {
    const map = new Map<string, number>();
    for (const i of this.incomes) {
      const b = i.bank?.trim() || 'Sin banco';
      map.set(b, (map.get(b) ?? 0) + i.amount);
    }
    return Array.from(map.entries()).map(([bank, total]) => ({ bank, total })).sort((a, b) => b.total - a.total);
  }

  private buildForm(inc?: Income): void {
    const dateStr = inc?.date
      ? (inc.date as string).substring(0, 10)
      : this.todayLocal();
    this.form = this.fb.group({
      amount:      [inc?.amount ?? '', [Validators.required, Validators.min(1)]],
      description: [inc?.description ?? '', Validators.required],
      date:        [dateStr, Validators.required],
      categoryId:  [typeof inc?.categoryId === 'object' ? (inc.categoryId as any)._id : (inc?.categoryId ?? ''), Validators.required],
      bank:        [inc?.bank ?? ''],
      notes:       [inc?.notes ?? ''],
    });
  }

  private todayLocal(): string {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
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

  openNew(): void    { this.editingId = null; this.buildForm(); this.showQuickCat = false; this.showModal = true; }
  openEdit(i: Income): void { this.editingId = i._id; this.buildForm(i); this.showQuickCat = false; this.showModal = true; }
  closeModal(): void { this.showModal = false; this.showQuickCat = false; }
  toggleQuickCat(): void { this.showQuickCat = !this.showQuickCat; }
  createQuickCat(name: string, input: HTMLInputElement): void {
    if (!name.trim()) return;
    this.categoriesService.create({ name: name.trim(), type: 'income', color: '#22c55e', icon: 'cash' })
      .subscribe({ next: (cat) => { this.categories = [...this.categories, cat]; this.form.patchValue({ categoryId: cat._id }); this.showQuickCat = false; input.value = ''; } });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const data = { ...this.form.value, amount: +this.form.value.amount };
    const call = this.editingId
      ? this.incomesService.update(this.editingId, data)
      : this.incomesService.create(data);
    call.subscribe({ next: () => { this.showModal = false; this.saving = false; this.loadIncomes(); }, error: () => { this.saving = false; } });
  }

  async delete(id: string): Promise<void> {
    const ok = await this.dialog.confirm('¿Eliminar este ingreso?');
    if (!ok) return;
    this.incomesService.delete(id).subscribe(() => this.loadIncomes());
  }

  getCatName(inc: Income): string  { return typeof inc.categoryId === 'object' ? (inc.categoryId as any).name : ''; }
  getCatColor(inc: Income): string { return typeof inc.categoryId === 'object' ? (inc.categoryId as any).color : '#22c55e'; }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
}
