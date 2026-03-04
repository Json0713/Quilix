import { Injectable, ApplicationRef, ComponentFactoryResolver, Injector, EmbeddedViewRef, ComponentRef } from '@angular/core';
import { SnackbarComponent } from './snackbar.component';

@Injectable({
    providedIn: 'root'
})
export class SnackbarService {
    private snackbarRef: ComponentRef<SnackbarComponent> | null = null;

    constructor(
        private appRef: ApplicationRef,
        private injector: Injector
    ) { }

    private getSnackbar(): SnackbarComponent {
        if (!this.snackbarRef) {
            // Need to setup the component if it doesn't exist
            const factory = (this.injector as any).get(ComponentFactoryResolver).resolveComponentFactory(SnackbarComponent);
            const ref = factory.create(this.injector);
            this.appRef.attachView(ref.hostView);
            const domElem = (ref.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
            document.body.appendChild(domElem);
            this.snackbarRef = ref;
        }
        return this.snackbarRef!.instance;
    }

    show(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) {
        // Modern Angular way for dynamic component without ComponentFactoryResolver
        // actually in standalone we can just inject a Document and use createComponent but for simplicity:
        // Let's use standard method:
        const snackbar = this.getSnackbar();
        snackbar.show(message, type, duration);
    }

    success(message: string, duration?: number) {
        this.show(message, 'success', duration);
    }

    error(message: string, duration?: number) {
        this.show(message, 'error', duration);
    }

    info(message: string, duration?: number) {
        this.show(message, 'info', duration);
    }
}
