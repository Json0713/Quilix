import { Routes } from '@angular/router';
import { PUBLIC_ROUTES } from './public/public.routes';
import { PRIVATE_ROUTES } from './private/private.routes';

export const routes: Routes = [
  
  ...PUBLIC_ROUTES,
  ...PRIVATE_ROUTES,

  { 
    path: '**', 
    redirectTo: '' 
  },

];
