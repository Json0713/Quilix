import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  isDevMode
} from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, RouteReuseStrategy } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';

import {
  SUPABASE_CLIENT,
  provideSupabaseClient
} from './meta/core/supabase/supabase.client';
import { MetaConfigService } from './meta/core/config/meta-config.service';
import { TabRouteReuseStrategy } from './core/strategies/tab-route-reuse.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    {
      provide: RouteReuseStrategy,
      useClass: TabRouteReuseStrategy,
    },

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),

    {
      provide: SUPABASE_CLIENT,
      useFactory: provideSupabaseClient,
      deps: [MetaConfigService]
    }
  ]
};
