import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DexieService, WidgetNote } from '../../../../core/database/dexie.service';

interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
}

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
export class BrowserDashboardComponent implements OnInit {
  private db = inject(DexieService);

  weather = signal<WeatherData | null>(null);
  upcomingEvents = signal<WidgetNote[]>([]);
  newsArticles = signal<NewsArticle[]>([]);
  isLoadingNews = signal(true);

  ngOnInit() {
    this.fetchWeather();
    this.fetchCalendarEvents();
    this.fetchNews();
  }

  async fetchNews() {
    try {
      const res = await fetch('https://dev.to/api/articles?per_page=6');
      const data = await res.json();
      
      const articles = data.map((item: any) => {
        let category = 'Tech';
        if (item.tag_list && item.tag_list.length > 0) {
          category = item.tag_list[0];
        }
        
        return {
          title: item.title,
          source: item.organization?.name || item.user?.name || 'Dev.to',
          time: item.readable_publish_date,
          imageUrl: item.social_image || item.cover_image || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=400&h=250',
          category: category,
          url: item.url
        };
      });
      
      this.newsArticles.set(articles);
    } catch (e) {
      console.error("Failed to fetch news", e);
    } finally {
      this.isLoadingNews.set(false);
    }
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
