import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DexieService, WidgetNote } from '../../../../core/database/dexie.service';

interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
}

interface NewsCategory {
  id: string;
  name: string;
  rssUrl: string;
}

const CATEGORIES: NewsCategory[] = [
  { id: 'top', name: 'Top News', rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { id: 'tech', name: 'Technology', rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' },
  { id: 'science', name: 'Science', rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml' },
  { id: 'business', name: 'Business', rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { id: 'sports', name: 'Sports', rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml' }
];

interface NewsArticle {
  title: string;
  source: string;
  time: string;
  imageUrl: string;
  category: string;
  url: string;
}

@Component({
  selector: 'app-browser-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './browser-dashboard.html',
  styleUrls: ['./browser-dashboard.scss']
})
export class BrowserDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private db = inject(DexieService);

  weather = signal<WeatherData | null>(null);
  upcomingEvents = signal<WidgetNote[]>([]);
  
  categories = CATEGORIES;
  activeCategory = signal<NewsCategory>(CATEGORIES[0]);
  
  allArticles: NewsArticle[] = [];
  displayedArticles = signal<NewsArticle[]>([]);
  isLoadingNews = signal(true);
  isLoadingMore = signal(false);
  hasMoreNews = signal(true);
  errorLoadingNews = signal(false);

  @ViewChild('scrollAnchor', { static: false }) scrollAnchor!: ElementRef;
  private observer: IntersectionObserver | null = null;

  ngOnInit() {
    this.fetchWeather();
    this.fetchCalendarEvents();
    this.fetchNews(this.activeCategory());
  }

  ngAfterViewInit() {
    this.setupIntersectionObserver();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        this.loadMore();
      }
    }, { rootMargin: '200px' });
  }

  // Helper to re-attach observer when anchor is conditionally rendered
  observeAnchor() {
    if (this.observer && this.scrollAnchor) {
      this.observer.observe(this.scrollAnchor.nativeElement);
    }
  }

  changeCategory(category: NewsCategory) {
    if (this.activeCategory().id === category.id && this.allArticles.length > 0) return;
    
    // Scroll to top of the dashboard feed seamlessly
    const scrollContainer = document.querySelector('.store-state');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }

    this.fetchNews(category);
  }

  async fetchNews(category: NewsCategory) {
    this.isLoadingNews.set(true);
    this.errorLoadingNews.set(false);
    this.activeCategory.set(category);
    this.allArticles = [];
    this.displayedArticles.set([]);
    this.hasMoreNews.set(true);
    
    try {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(category.rssUrl)}`);
      const data = await res.json();
      
      if (data.items && data.items.length > 0) {
        this.allArticles = data.items.map((item: any) => ({
          title: item.title,
          source: data.feed?.title || 'News',
          time: this.timeSince(new Date(item.pubDate)),
          imageUrl: this.extractImage(item),
          category: category.name,
          url: item.link
        })).filter((a: any) => a.imageUrl); // require image for better UI
        
        if (this.allArticles.length === 0) {
          this.errorLoadingNews.set(true);
        } else {
          this.loadMore();
        }
      } else {
        this.errorLoadingNews.set(true);
      }
    } catch (e) {
      console.error("Failed to fetch news", e);
      this.errorLoadingNews.set(true);
    } finally {
      this.isLoadingNews.set(false);
      setTimeout(() => this.observeAnchor(), 100);
    }
  }

  extractImage(item: any): string {
    if (item.enclosure && item.enclosure.link) return item.enclosure.link;
    if (item.thumbnail) return item.thumbnail;
    const imgMatch = item.description?.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) return imgMatch[1];
    return 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=400&h=250';
  }

  timeSince(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";
    return Math.floor(seconds) + " secs ago";
  }

  loadMore() {
    if (this.isLoadingMore() || !this.hasMoreNews()) return;
    
    const currentLength = this.displayedArticles().length;
    if (currentLength >= this.allArticles.length) {
      this.hasMoreNews.set(false);
      return;
    }

    this.isLoadingMore.set(true);
    setTimeout(() => {
      const nextBatch = this.allArticles.slice(currentLength, currentLength + 6);
      this.displayedArticles.set([...this.displayedArticles(), ...nextBatch]);
      
      if (this.displayedArticles().length >= this.allArticles.length) {
        this.hasMoreNews.set(false);
      }
      this.isLoadingMore.set(false);
    }, 400); // Simulate network delay for smooth UI feedback
  }

  openArticle(url: string) {
    window.open(url, '_blank');
  }

  async fetchWeather() {
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          await this.loadWeatherForCoords(pos.coords.latitude, pos.coords.longitude);
        }, async () => {
          await this.loadWeatherForCoords(40.71, -74.01); // Fallback to NY
        });
      } else {
        await this.loadWeatherForCoords(40.71, -74.01); // Fallback
      }
    } catch (e) {
      console.error("Geolocation failed", e);
    }
  }

  private async loadWeatherForCoords(lat: number, lng: number) {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
      const data = await res.json();
      
      const current = data.current_weather;
      let condition = "Clear";
      let icon = "bi-sun";

      // Basic WMO weather code mapping
      const code = current.weathercode;
      if (code >= 1 && code <= 3) { condition = "Partly Cloudy"; icon = "bi-cloud-sun"; }
      else if (code >= 45 && code <= 48) { condition = "Fog"; icon = "bi-cloud-fog"; }
      else if (code >= 51 && code <= 67) { condition = "Rain"; icon = "bi-cloud-rain"; }
      else if (code >= 71 && code <= 77) { condition = "Snow"; icon = "bi-snow"; }
      else if (code >= 95) { condition = "Thunderstorm"; icon = "bi-cloud-lightning-rain"; }

      this.weather.set({
        temperature: Math.round(current.temperature),
        condition,
        icon
      });
    } catch (e) {
      console.error("Failed to fetch weather", e);
    }
  }

  async fetchCalendarEvents() {
    try {
      const allNotes = await this.db.widget_notes.toArray();
      const today = new Date();
      today.setHours(0,0,0,0);

      // Filter notes that are today or in the future
      const upcoming = allNotes.filter(note => {
        const noteDate = new Date(note.date + 'T00:00:00');
        return noteDate >= today;
      });

      // Sort by closest date first
      upcoming.sort((a, b) => a.date.localeCompare(b.date));
      
      // Take top 3
      this.upcomingEvents.set(upcoming.slice(0, 3));
    } catch (e) {
      console.error("Failed to fetch calendar events", e);
    }
  }
}
