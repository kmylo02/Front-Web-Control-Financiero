import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoriesService } from '../../core/services/categories.service';
import { Category } from '../../core/models';

const ICONS = ['receipt','home','car','food','health','education','entertainment',
  'shopping','travel','salary','investment','gift','other'];
const COLORS = ['#6366f1','#ef4444','#f97316','#eab308','#22c55e','#14b8a6',
  '#3b82f6','#8b5cf6','#ec4899','#64748b','#84cc16','#06b6d4'];

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss'],
  imports: [NgFor, NgIf, NgClass, FormsModule],
})
export class CategoriesComponent implements OnInit {
  categories: Category[] = [];
  loading   = true;
  saving    = false;
  filterType: 'all' | 'expense' | 'income' | 'both' = 'all';

  showForm  = false;
  editingId: string | null = null;

  form = { name: '', type: 'expense' as 'expense' | 'income' | 'both', icon: 'receipt', color: '#6366f1' };

  icons  = ICONS;
  colors = COLORS;

  constructor(private categoriesService: CategoriesService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.categoriesService.getAll().subscribe({
      next: cats => { this.categories = cats; this.loading = false; },
      error: ()   => { this.loading = false; },
    });
  }

  get filtered(): Category[] {
    if (this.filterType === 'all') return this.categories;
    return this.categories.filter(c => c.type === this.filterType || c.type === 'both');
  }

  openNew(): void {
    this.editingId = null;
    this.form = { name: '', type: 'expense', icon: 'receipt', color: '#6366f1' };
    this.showForm = true;
  }

  openEdit(cat: Category): void {
    this.editingId = cat._id;
    this.form = { name: cat.name, type: cat.type, icon: cat.icon, color: cat.color };
    this.showForm = true;
  }

  save(): void {
    if (!this.form.name.trim()) return;
    this.saving = true;
    const op = this.editingId
      ? this.categoriesService.update(this.editingId, this.form)
      : this.categoriesService.create(this.form);
    op.subscribe({
      next: () => { this.saving = false; this.showForm = false; this.load(); },
      error: () => { this.saving = false; },
    });
  }

  delete(cat: Category): void {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    this.categoriesService.delete(cat._id).subscribe({ next: () => this.load() });
  }

  cancel(): void { this.showForm = false; }

  typeBadge(type: string): string {
    return type === 'expense' ? 'Gasto' : type === 'income' ? 'Ingreso' : 'Ambos';
  }
  typeClass(type: string): string {
    return type === 'expense' ? 'badge-danger' : type === 'income' ? 'badge-success' : 'badge-info';
  }
}
