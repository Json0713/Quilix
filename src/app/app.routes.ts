import { Routes } from '@angular/router';
import { PUBLIC_ROUTES } from './public/public.routes';

export const routes: Routes = [
  
  ...PUBLIC_ROUTES,
  { path: '**', redirectTo: '' },




];
