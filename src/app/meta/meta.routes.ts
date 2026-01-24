import { Routes } from '@angular/router';

import { PRIVATE_META_ROUTES } from './private/private-meta.routes';
import { PUBLIC_META_ROUTES } from './public/public-meta.routes';

export const META_ROUTES: Routes = [
    {
        path: '',
        children: PUBLIC_META_ROUTES
    },
    {
        path: '',
        // canActivate: [MetaAuthGuard],
        children: PRIVATE_META_ROUTES
    },
    {
        path: '**',
        redirectTo: ''
    }

];
