import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Expense } from '../models';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private base = `${environment.apiUrl}/expenses`;
  constructor(private http: HttpClient) {}

  getAll(year?: number, month?: number): Observable<Expense[]> {
    const params: Record<string, string> = {};
    if (year) params['year'] = year.toString();
    if (month) params['month'] = month.toString();
    return this.http.get<Expense[]>(this.base, { params });
  }

  getSummary(year: number, month: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/summary`, {
      params: { year: year.toString(), month: month.toString() },
    });
  }

  getOne(id: string): Observable<Expense> {
    return this.http.get<Expense>(`${this.base}/${id}`);
  }

  create(data: Partial<Expense>): Observable<Expense> {
    return this.http.post<Expense>(this.base, data);
  }

  update(id: string, data: Partial<Expense>): Observable<Expense> {
    return this.http.put<Expense>(`${this.base}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
