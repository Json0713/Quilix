import { Routes } from '@angular/router';
import { PublicIndex } from './index/index';
import { PublicTemplate } from './template/template';
import { Login } from '../auth/login/login';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicTemplate,
    children: [
      { path: '', component: PublicIndex },
      { path: 'login', component: Login }


    ]
  }


];
