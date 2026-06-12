import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class DialogService {
  confirm(title: string, text = '', confirmText = 'Eliminar'): Promise<boolean> {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
    }).then(result => result.isConfirmed);
  }

  success(title: string, text = ''): Promise<void> {
    return Swal.fire({ title, text, icon: 'success', confirmButtonColor: '#6366f1', timer: 2000, showConfirmButton: false }).then(() => undefined);
  }

  error(title: string, text = ''): Promise<void> {
    return Swal.fire({ title, text, icon: 'error', confirmButtonColor: '#ef4444' }).then(() => undefined);
  }
}
