import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { MetaEnv } from './meta-env';


@Injectable({ providedIn: 'root' 
})
export class MetaConfigService {

  readonly env: MetaEnv = environment.meta;

}
