import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' 
})
export class QuilixVersionService {

  readonly appName = environment.appName;
  readonly version = environment.version;
  
}
