import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
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
  imports: [NgIf, NgFor, ReactiveFormsModule],
})
export class RecurringComponent implements OnInit {
  loading = true;
  recurrents: Recurring[]  = [];
  pending:    Recurring[]  = [];
  categories: Category[]   = [];
  recurringBills: BillItem[] = [];

  today = new Date();
  currentYear  = this.today.getFullYear();
  currentMonth = this.today.getMonth() + 1;
  showModal    = false;
  editingId: string | null = null;
  saving       = false;
  activatingId: string | null = null;
  showQuickCat = false;
  form!: FormGroup;

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
      bills:   this.billItemsService.getByMonth(this.currentYear, this.currentMonth),
    }).subscribe(({ all, pending, bills }) => {
      this.recurrents     = all;
      this.pending        = pending;
      this.recurringBills = bills.filter(b => b.isRecurring);
    });
  }

  getCatName(r: Recurring): string { return typeof r.categoryId === 'object' ? (r.categoryId as any).name : ''; }

  billCatName(b: BillItem): string  { return typeof b.categoryId === 'object' ? (b.categoryId as any).name : ''; }
  billCatColor(b: BillItem): string { return typeof b.categoryId === 'object' ? (b.categoryId as any).color : '#6366f1'; }

  toggleBill(b: BillItem): void {
    this.billItemsService.toggle(b._id).subscribe(() => {
      this.billItemsService.getByMonth(this.currentYear, this.currentMonth)
        .subscribe(bills => { this.recurringBills = bills.filter(x => x.isRecurring); });
    });
  }
  modeLabel(mode: string): string  { return this.modes.find(m => m.value === mode)?.label ?? mode; }
  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  }
}
