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
  { id: 'sports', name: 'Sports', rssUrl: 'https://www.espn.com/espn/rss/news' }
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
  weatherError = signal(false);
  calendarError = signal(false);
  
  activeMobileWidget = signal<'weather' | 'calendar'>('weather');

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

  private getCache(key: string) {
    try {
      const item = sessionStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        // Expiry of 30 mins
        if (new Date().getTime() - parsed.timestamp < 30 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch(e) {}
    return null;
  }

  private setCache(key: string, data: any) {
    try {
      sessionStorage.setItem(key, JSON.stringify({
        timestamp: new Date().getTime(),
        data
      }));
    } catch(e) {}
  }

  changeCategory(category: NewsCategory) {
    if (this.activeCategory().id === category.id && this.allArticles.length > 0) return;
    
    // Scroll to the top of the news feed seamlessly
    const newsSection = document.querySelector('.main-column');
    if (newsSection) {
      newsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this.fetchNews(category);
  }

  async getUserLocationInfo(): Promise<{ name: string, code: string } | null> {
    const cacheKey = 'user_location_info_v2';
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
    try {
      const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client');
      if (!res.ok) return null;
      const data = await res.json();
      if (data.countryName && data.countryCode) {
        const info = { name: data.countryName, code: data.countryCode };
        sessionStorage.setItem(cacheKey, JSON.stringify(info));
        return info;
      }
    } catch (e) {
      console.warn("Could not fetch user location", e);
    }
    return null;
  }

  async fetchNews(category: NewsCategory) {
    this.isLoadingNews.set(true);
    this.errorLoadingNews.set(false);
    this.activeCategory.set(category);
    this.allArticles = [];
    this.displayedArticles.set([]);
    this.hasMoreNews.set(true);
    
    const cacheKey = `news_category_v2_${category.id}`;
    const cachedNews = this.getCache(cacheKey);
    if (cachedNews) {
      this.allArticles = cachedNews;
      this.loadMore();
      this.isLoadingNews.set(false);
      setTimeout(() => this.observeAnchor(), 100);
      return;
    }

    if (!navigator.onLine) {
      this.errorLoadingNews.set(true);
      this.isLoadingNews.set(false);
      return;
    }

    try {
      const fetchPrimary = fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(category.rssUrl)}`)
        .then(res => {
          if (!res.ok) throw new Error('News fetch failed');
          return res.json();
        });

      let fetchLocal: Promise<any> = Promise.resolve({ items: [] });
      if (category.id === 'top') {
         const location = await this.getUserLocationInfo();
         if (location && location.name) {
            const localRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(location.name + ' news')}`;
            fetchLocal = fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(localRssUrl)}`)
              .then(res => res.ok ? res.json() : { items: [] })
              .catch(() => ({ items: [] }));
         }
      }

      const [primaryData, localData] = await Promise.all([fetchPrimary, fetchLocal]);
      
      let mergedItems: any[] = [];
      const primaryItems = primaryData.items || [];
      const localItems = localData.items || [];

      // Interleave items: 1 primary, 1 local, 1 primary, 1 local...
      const maxLength = Math.max(primaryItems.length, localItems.length);
      for (let i = 0; i < maxLength; i++) {
        if (i < primaryItems.length) mergedItems.push({...primaryItems[i], isLocal: false});
        if (i < localItems.length) mergedItems.push({...localItems[i], isLocal: true});
      }

      if (mergedItems.length > 0) {
        this.allArticles = mergedItems.map((item: any) => ({
          title: item.title,
          source: item.isLocal ? (localData.feed?.title || 'Local News').replace(' - Google News', '') : (primaryData.feed?.title || 'News'),
          time: this.timeSince(new Date(item.pubDate)),
          imageUrl: this.extractImage(item),
          category: item.isLocal ? 'Local News' : category.name,
          url: item.link
        })).filter((a: any) => a.imageUrl); // require image for better UI
        
        if (this.allArticles.length === 0) {
          this.errorLoadingNews.set(true);
        } else {
          this.setCache(cacheKey, this.allArticles);
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

  getPlaceholderImage(): string {
    const images = [
      'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=400&h=250',
      'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&q=80&w=400&h=250',
      'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400&h=250',
      'https://images.unsplash.com/photo-1586339949916-3e9457bef6d3?auto=format&fit=crop&q=80&w=400&h=250'
    ];
    return images[Math.floor(Math.random() * images.length)];
  }

  extractImage(item: any): string {
    if (item.enclosure && item.enclosure.link) return item.enclosure.link;
    if (item.thumbnail) return item.thumbnail;
    const imgMatch = item.description?.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) return imgMatch[1];
    return this.getPlaceholderImage();
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
    this.weatherError.set(false);
    
    const cachedWeather = this.getCache('weather_widget_data');
    if (cachedWeather) {
      this.weather.set(cachedWeather);
      return;
    }

    if (!navigator.onLine) {
      this.weatherError.set(true);
      return;
    }

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
      this.weatherError.set(true);
    }
  }

  private async loadWeatherForCoords(lat: number, lng: number) {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
      if (!res.ok) throw new Error('Weather fetch failed');
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

      const weatherData = {
        temperature: Math.round(current.temperature),
        condition,
        icon
      };

      this.weather.set(weatherData);
      this.setCache('weather_widget_data', weatherData);
    } catch (e) {
      console.error("Failed to fetch weather", e);
      this.weatherError.set(true);
    }
  }

  async fetchCalendarEvents() {
    this.calendarError.set(false);
    try {
      const allNotes = await this.db.widget_notes.toArray();
      const today = new Date();
      today.setHours(0,0,0,0);

      // Filter notes that are today or in the future
      let upcoming: WidgetNote[] = allNotes.filter(note => {
        const noteDate = new Date(note.date + 'T00:00:00');
        return noteDate >= today;
      });

      // Fetch public holidays based on user's country
      const location = await this.getUserLocationInfo();
      if (location && location.code) {
        try {
          const res = await fetch(`https://date.nager.at/api/v3/NextPublicHolidays/${location.code}`);
          if (res.ok) {
            const holidays = await res.json();
            const holidayNotes: WidgetNote[] = holidays.map((h: any) => ({
              id: 'holiday-' + h.date + '-' + Math.random().toString(),
              date: h.date,
              title: h.localName,
              content: h.name === h.localName ? "Public Holiday" : `Public Holiday (${h.name})`,
              priority: 'low',
              reminderEnabled: false,
              reminderTime: '',
              createdAt: Date.now()
            }) as WidgetNote).filter((note: WidgetNote) => {
              const noteDate = new Date(note.date + 'T00:00:00');
              return noteDate >= today;
            });
            
            // Merge holidays but prefer user notes on the same day
            const existingDates = new Set(upcoming.map(n => n.date));
            const filteredHolidays = holidayNotes.filter(h => !existingDates.has(h.date));
            upcoming = [...upcoming, ...filteredHolidays];
          }
        } catch (e) {
          console.warn("Failed to fetch public holidays", e);
        }
      }

      // Sort by closest date first
      upcoming.sort((a, b) => a.date.localeCompare(b.date));
      
      // Take top 3
      this.upcomingEvents.set(upcoming.slice(0, 3));
    } catch (e) {
      console.error("Failed to fetch calendar events", e);
      this.calendarError.set(true);
    }
  }
}
