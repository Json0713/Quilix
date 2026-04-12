import { Component, inject, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GlobalSearchService, SearchItem } from '../../../core/services/ui/global-search.service';
import { ModalService } from '../../../services/ui/common/modal/modal';

@Component({
    selector: 'app-global-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './global-search.html',
    styleUrl: './global-search.scss'
})
export class GlobalSearchComponent implements OnInit, AfterViewInit {
    private searchService = inject(GlobalSearchService);
    private modalService = inject(ModalService);

    @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

    searchQuery = '';
    results: SearchItem[] = [];
    selectedIndex = 0;

    ngOnInit() {
        this.results = this.searchService.getSearchItems();
    }

    ngAfterViewInit() {
        setTimeout(() => {
            if (this.searchInput) {
                this.searchInput.nativeElement.focus();
            }
        }, 50);
    }

    onSearch() {
        this.results = this.searchService.search(this.searchQuery);
        this.selectedIndex = 0;
    }

    @HostListener('keydown', ['$event'])
    handleKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
            this.ensureActiveItemVisible();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % this.results.length;
            this.ensureActiveItemVisible();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (this.results[this.selectedIndex]) {
                this.executeAction(this.results[this.selectedIndex]);
            }
        } else if (event.key === 'Escape') {
            this.modalService.cancelResult();
        }
    }

    executeAction(item: SearchItem) {
        item.action();
        this.close();
    }

    close() {
        this.modalService.cancelResult(true);
    }

    selectIndex(index: number) {
        this.selectedIndex = index;
    }

    private ensureActiveItemVisible() {
        const activeEl = document.querySelector('.search-result-item.active');
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
}
