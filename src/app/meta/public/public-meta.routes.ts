import { Routes } from '@angular/router';

import { RegisterMeta } from '../auth/register-meta/register-meta';
import { LoginMeta } from '../auth/login-meta/login-meta';
import { PublicMetaTemplate } from './template/template';
import { PublicMetaIndex } from './index/index'


export const PUBLIC_META_ROUTES: Routes = [

    {
        path: '',
        component: PublicMetaTemplate,
        children: [
            { path: '', component: PublicMetaIndex },
            { path: 'login', component: LoginMeta },
            { path: 'register', component: RegisterMeta }
        ]
    }

];
