import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { RecurringService } from '../../core/services/recurring.service';
import { CategoriesService } from '../../core/services/categories.service';
import { BillItemsService } from '../../core/services/bill-items.service';
import { DialogService } from '../../core/services/dialog.service';
import { Recurring, Category, BillItem } from '../../core/models';

@Component({
  selector: 'app-recurring',
  templateUrl: './recurring.component.html',
  styleUrls: ['./recurring.component.scss'],
  imports: [NgIf, NgFor, RouterLink, ReactiveFormsModule],
})
export class RecurringComponent implements OnInit {
  loading = true;
  recurrents: Recurring[]  = [];
  pending:    Recurring[]  = [];
  categories: Category[]   = [];
  recurringBills: BillItem[] = [];
  dayFilter: number | null  = null;

  today        = new Date();
  currentYear  = this.today.getFullYear();
  currentMonth = this.today.getMonth() + 1;
  showModal    = false;
  editingId: string | null = null;
  saving       = false;
  activatingId: string | null = null;
  showQuickCat = false;
  form!: FormGroup;

  readonly MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  get monthLabel() { return `${this.MONTH_NAMES[this.currentMonth - 1]} ${this.currentYear}`; }

  // KPI getters
  get billsAll()          { return this.recurringBills; }
  get billsPendingList()  { return this.recurringBills.filter(b => b.status === 'pending'); }
  get billsPaidList()     { return this.recurringBills.filter(b => b.status === 'paid'); }
  get billsTotal()        { return this.recurringBills.reduce((s, b) => s + b.amount, 0); }
  get billsTotalPending() { return this.billsPendingList.reduce((s, b) => s + b.amount, 0); }
  get billsTotalPaid()    { return this.billsPaidList.reduce((s, b) => s + b.amount, 0); }
  get billsPercent()      { return this.billsTotal > 0 ? Math.round((this.billsTotalPaid / this.billsTotal) * 100) : 0; }

  // Unique sorted days that have bills
  get activeDays(): number[] {
    return [...new Set(this.recurringBills.map(b => b.dueDay))].sort((a, b) => a - b);
  }

  // Bills filtered by selected day, sorted pending-first then by dueDay
  get filteredBills(): BillItem[] {
    const list = this.dayFilter !== null
      ? this.recurringBills.filter(b => b.dueDay === this.dayFilter)
      : this.recurringBills;
    const pending = list.filter(b => b.status === 'pending').sort((a, b) => a.dueDay - b.dueDay);
    const paid    = list.filter(b => b.status === 'paid').sort((a, b) => a.dueDay - b.dueDay);
    return [...pending, ...paid];
  }

  isOverdue(b: BillItem): boolean {
    return b.status === 'pending'
      && this.currentYear  === this.today.getFullYear()
      && this.currentMonth === this.today.getMonth() + 1
      && b.dueDay < this.today.getDate();
  }

  isDueToday(b: BillItem): boolean {
    return b.status === 'pending'
      && this.currentYear  === this.today.getFullYear()
      && this.currentMonth === this.today.getMonth() + 1
      && b.dueDay === this.today.getDate();
  }

  readonly modes = [
    { value: 'auto',     label: 'Automático', desc: 'Se genera solo el día 1 de cada mes' },
    { value: 'manual',   label: 'Manual',      desc: 'Tú lo confirmas cada mes' },
    { value: 'template', label: 'Plantilla',   desc: 'Copias y ajustas el monto cada mes' },
  ];

  constructor(
    private recurringService: RecurringService,
    private categoriesService: CategoriesService,
    private billItemsService: BillItemsService,
    private dialog: DialogService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    forkJoin({
      all:     this.recurringService.getAll(),
      pending: this.recurringService.getPending(),
      cats:    this.categoriesService.getAll(),
      bills:   this.billItemsService.getByMonth(this.currentYear, this.currentMonth),
    }).subscribe(({ all, pending, cats, bills }) => {
      this.recurrents     = all;
      this.pending        = pending;
      this.categories     = cats;
      this.recurringBills = bills.filter(b => b.isRecurring);
      this.loading        = false;
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

  changeMonth(dir: number): void {
    this.currentMonth += dir;
    if (this.currentMonth > 12) { this.currentMonth = 1; this.currentYear++; }
    if (this.currentMonth < 1)  { this.currentMonth = 12; this.currentYear--; }
    this.dayFilter = null;
    this.loadBills();
  }

  private loadBills(): void {
    this.billItemsService.getByMonth(this.currentYear, this.currentMonth)
      .subscribe(bills => { this.recurringBills = bills.filter(b => b.isRecurring); });
  }

  openNew(): void { this.editingId = null; this.buildForm(); this.showQuickCat = false; this.showModal = true; }
  openEdit(r: Recurring): void { this.editingId = r._id; this.buildForm(r); this.showQuickCat = false; this.showModal = true; }
  closeModal(): void { this.showModal = false; this.showQuickCat = false; }
  toggleQuickCat(): void { this.showQuickCat = !this.showQuickCat; }
  createQuickCat(name: string, type: string, input: HTMLInputElement): void {
    if (!name.trim()) return;
    this.categoriesService.create({ name: name.trim(), type: type as any, color: '#6366f1', icon: 'receipt' })
      .subscribe({ next: (cat) => { this.categories = [...this.categories, cat]; this.form.patchValue({ categoryId: cat._id }); this.showQuickCat = false; input.value = ''; } });
  }

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

  async delete(id: string): Promise<void> {
    const ok = await this.dialog.confirm('¿Eliminar recurrente?');
    if (!ok) return;
    this.recurringService.delete(id).subscribe(() => this.reload());
  }

  private reload(): void {
    forkJoin({
      all:     this.recurringService.getAll(),
      pending: this.recurringService.getPending(),
    }).subscribe(({ all, pending }) => {
      this.recurrents = all;
      this.pending    = pending;
      this.loadBills();
    });
  }

  getCatName(r: Recurring): string { return typeof r.categoryId === 'object' ? (r.categoryId as any).name : ''; }

  billCatName(b: BillItem): string  { return typeof b.categoryId === 'object' ? (b.categoryId as any).name : ''; }
  billCatColor(b: BillItem): string { return typeof b.categoryId === 'object' ? (b.categoryId as any).color : '#6366f1'; }

  toggleBill(b: BillItem): void {
    this.billItemsService.toggle(b._id).subscribe(() => this.loadBills());
  }
  modeLabel(mode: string): string  { return this.modes.find(m => m.value === mode)?.label ?? mode; }
  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
}
