import { Routes } from '@angular/router';
import { Index } from './public/index';

export const routes: Routes = [
  {
    path: '',
    component: Index
  },
  {
    path: '**',
    redirectTo: ''
  }
];
