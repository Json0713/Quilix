import { Injectable, ApplicationRef, ComponentFactoryResolver, Injector, EmbeddedViewRef, ComponentRef } from '@angular/core';
import { SnackbarComponent } from '../../../../shared/ui/common/snackbar/snackbar';

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
            const factory = (this.injector as any).get(ComponentFactoryResolver).resolveComponentFactory(SnackbarComponent);
            const ref = factory.create(this.injector);
            this.appRef.attachView(ref.hostView);
            const domElem = (ref.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
            document.body.appendChild(domElem);
            this.snackbarRef = ref;
        }
        return this.snackbarRef!.instance;
    }

    show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration: number = 3000) {
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

    warning(message: string, duration?: number) {
        this.show(message, 'warning', duration);
    }
}
