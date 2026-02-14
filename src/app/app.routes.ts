import { Routes } from '@angular/router';

export const routes: Routes = [

  {
    path: '',
    loadChildren: () =>
      import('./public/public.routes').then(m => m.PUBLIC_ROUTES)
  },

  {
    path: '',
    loadChildren: () =>
      import('./private/private.routes').then(m => m.PRIVATE_ROUTES)
  },

  {
    path: 'meta',
    loadChildren: () =>
      import('./meta/meta.routes').then(m => m.META_ROUTES),
  },

  {
    path: '**',
    redirectTo: ''
  },

];
