import { Injectable } from '@angular/core';
import { db } from '../../database/dexie.service';
import { BrowserBookmark } from '../../database/dexie.models';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BrowserBookmarkService {

  constructor() {
    this.seedDefaultsIfNeeded();
  }

  /**
   * Observe all bookmarks reactively
   */
  getBookmarks$(): Observable<BrowserBookmark[]> {
    return from(liveQuery(() => db.browser_bookmarks.orderBy('createdAt').toArray())) as Observable<BrowserBookmark[]>;
  }

  /**
   * Add a new bookmark. ID is the URL.
   */
  async addBookmark(bookmark: Omit<BrowserBookmark, 'createdAt' | 'id'> & { url: string }): Promise<void> {
    const id = bookmark.url;
    
    // Check if it already exists
    const exists = await db.browser_bookmarks.get(id);
    if (!exists) {
      await db.browser_bookmarks.add({
        ...bookmark,
        id,
        createdAt: Date.now()
      });
    }
  }

  /**
   * Remove a bookmark by URL (ID)
   */
  async removeBookmark(url: string): Promise<void> {
    await db.browser_bookmarks.delete(url);
  }

  /**
   * Check if a specific URL is bookmarked
   */
  async isBookmarked(url: string): Promise<boolean> {
    const b = await db.browser_bookmarks.get(url);
    return !!b;
  }

  /**
   * Seeds the database with default modern apps if it's entirely empty
   * and we haven't seeded before (using settings table as a flag).
   */
  private async seedDefaultsIfNeeded(): Promise<void> {
    const SEED_KEY = 'browser_bookmarks_seeded_v4';
    const hasSeeded = await db.settings.get(SEED_KEY);

    if (hasSeeded) {
      return;
    }

    // Clear old bookmarks to ensure a clean slate for the new preset list
    await db.browser_bookmarks.clear();

    const defaultPresets: BrowserBookmark[] = [
      {
        id: 'https://excalidraw.com/',
        url: 'https://excalidraw.com/',
        title: 'Excalidraw',
        icon: 'bi-pen',
        category: 'Tools',
        description: 'Virtual Whiteboard',
        createdAt: Date.now() + 1
      },
      {
        id: 'https://littlealchemy2.com/',
        url: 'https://littlealchemy2.com/',
        title: 'Little Alchemy 2',
        icon: 'bi-magic',
        category: 'Games',
        description: 'Crafting Puzzle Game',
        createdAt: Date.now() + 2
      },
      {
        id: 'http://slither.com/io',
        url: 'http://slither.com/io',
        title: 'Slither.io',
        icon: 'bi-bug',
        category: 'Games',
        description: 'Classic Snake MMO',
        createdAt: Date.now() + 3
      },
      {
        id: 'https://slowroads.io/',
        url: 'https://slowroads.io/',
        title: 'Slow Roads',
        icon: 'bi-car-front',
        category: 'Games',
        description: 'Endless 3D Driving',
        createdAt: Date.now() + 4
      },
      {
        id: 'https://sandspiel.club/',
        url: 'https://sandspiel.club/',
        title: 'Sandspiel',
        icon: 'bi-droplet',
        category: 'Games',
        description: 'Falling Sand Physics',
        createdAt: Date.now() + 5
      },
      {
        id: 'https://voxiom.io/',
        url: 'https://voxiom.io/',
        title: 'Voxiom.io',
        icon: 'bi-boxes',
        category: 'Games',
        description: 'Voxel Battle Royale',
        createdAt: Date.now() + 6
      }
    ];

    await db.browser_bookmarks.bulkAdd(defaultPresets);
    await db.settings.put({ key: SEED_KEY, value: true });
  }
}
