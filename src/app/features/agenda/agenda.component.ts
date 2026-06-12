import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { BillItemsService } from '../../core/services/bill-items.service';
import { CategoriesService } from '../../core/services/categories.service';
import { DialogService } from '../../core/services/dialog.service';
import { BillItem, Category, MONTH_NAMES } from '../../core/models';

@Component({
  selector: 'app-agenda',
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.scss'],
  imports: [NgIf, NgFor, NgClass, ReactiveFormsModule],
})
export class AgendaComponent implements OnInit {
  loading   = true;
  saving    = false;
  bills: BillItem[]     = [];
  categories: Category[] = [];

  today     = new Date();
  year      = this.today.getFullYear();
  month     = this.today.getMonth() + 1;
  todayDay  = this.today.getDate();

  showModal    = false;
  editingId: string | null = null;
  form!: FormGroup;

  get monthName() { return MONTH_NAMES[this.month - 1]; }
  get pending()   { return this.bills.filter(b => b.status === 'pending'); }
  get paid()      { return this.bills.filter(b => b.status === 'paid'); }
  get totalPending() { return this.pending.reduce((s, b) => s + b.amount, 0); }
  get totalPaid()    { return this.paid.reduce((s, b) => s + b.amount, 0); }
  get totalAll()     { return this.bills.reduce((s, b) => s + b.amount, 0); }
  get paidPercent()  { return this.totalAll > 0 ? Math.round((this.totalPaid / this.totalAll) * 100) : 0; }

  isOverdue(bill: BillItem): boolean {
    return bill.status === 'pending'
      && this.year === this.today.getFullYear()
      && this.month === this.today.getMonth() + 1
      && bill.dueDay < this.todayDay;
  }

  isDueToday(bill: BillItem): boolean {
    return bill.status === 'pending'
      && this.year === this.today.getFullYear()
      && this.month === this.today.getMonth() + 1
      && bill.dueDay === this.todayDay;
  }

  constructor(
    private billItemsService: BillItemsService,
    private categoriesService: CategoriesService,
    private dialog: DialogService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.categoriesService.getAll().subscribe(cats => { this.categories = cats; });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.billItemsService.getByMonth(this.year, this.month).subscribe({
      next: bills => { this.bills = bills; this.loading = false; },
      error: ()    => { this.loading = false; },
    });
  }

  changeMonth(dir: number): void {
    this.month += dir;
    if (this.month > 12) { this.month = 1; this.year++; }
    if (this.month < 1)  { this.month = 12; this.year--; }
    this.load();
  }

  private buildForm(bill?: BillItem): void {
    const catId = bill?.categoryId
      ? (typeof bill.categoryId === 'object' ? (bill.categoryId as Category)._id : bill.categoryId)
      : '';
    this.form = this.fb.group({
      name:        [bill?.name ?? '',         Validators.required],
      amount:      [bill?.amount ?? '',        [Validators.required, Validators.min(0)]],
      categoryId:  [catId,                    ''],
      dueDay:      [bill?.dueDay ?? this.todayDay, [Validators.required, Validators.min(1), Validators.max(31)]],
      isRecurring: [bill?.isRecurring ?? false],
      notes:       [bill?.notes ?? ''],
    });
  }

  openNew(): void {
    this.editingId = null;
    this.buildForm();
    this.showModal = true;
  }

  openEdit(bill: BillItem): void {
    this.editingId = bill._id;
    this.buildForm(bill);
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const data = {
      ...this.form.value,
      amount: +this.form.value.amount,
      dueDay: +this.form.value.dueDay,
      year:   this.year,
      month:  this.month,
      categoryId: this.form.value.categoryId || undefined,
    };
    const call = this.editingId
      ? this.billItemsService.update(this.editingId, data)
      : this.billItemsService.create(data);
    call.subscribe({
      next: () => { this.saving = false; this.showModal = false; this.load(); },
      error: ()  => { this.saving = false; },
    });
  }

  toggle(bill: BillItem): void {
    this.billItemsService.toggle(bill._id).subscribe(() => this.load());
  }

  async delete(bill: BillItem): Promise<void> {
    const ok = await this.dialog.confirm('¿Eliminar pago?', `"${bill.name}" será eliminado.`);
    if (!ok) return;
    this.billItemsService.delete(bill._id).subscribe(() => this.load());
  }

  async copyToNextMonth(): Promise<void> {
    const ok = await this.dialog.confirm(
      '¿Copiar al siguiente mes?',
      'Solo se copiarán los pagos marcados como recurrentes.',
      'Copiar',
    );
    if (!ok) return;
    this.billItemsService.copyToNextMonth(this.year, this.month).subscribe(() => {
      this.dialog.success('Pagos copiados', 'Los recurrentes del mes fueron copiados al siguiente mes.');
    });
  }

  catName(bill: BillItem): string {
    return typeof bill.categoryId === 'object' ? (bill.categoryId as Category).name : '';
  }

  catColor(bill: BillItem): string {
    return typeof bill.categoryId === 'object' ? (bill.categoryId as Category).color : '#6366f1';
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
}
