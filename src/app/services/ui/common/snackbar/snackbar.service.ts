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

    show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration: number = 18000, action?: { label: string, callback: () => void }) {
        const snackbar = this.getSnackbar();
        snackbar.show(message, type, duration, action);
    }

    success(message: string, duration?: number, action?: { label: string, callback: () => void }) {
        this.show(message, 'success', duration, action);
    }

    error(message: string, duration?: number, action?: { label: string, callback: () => void }) {
        this.show(message, 'error', duration, action);
    }

    info(message: string, duration?: number, action?: { label: string, callback: () => void }) {
        this.show(message, 'info', duration, action);
    }

    warning(message: string, duration?: number, action?: { label: string, callback: () => void }) {
        this.show(message, 'warning', duration, action);
    }
}
