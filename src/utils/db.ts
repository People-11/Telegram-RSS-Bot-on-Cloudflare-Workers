import { Language } from "./i18n";

export interface RSSSubscription {
  id?: number;
  user_id: number;
  feed_url: string;
  feed_title: string;
  last_fetch_time?: number;
  last_item_guid?: string;
  created_at: number;
}

export class Database {
  private cache = caches.default;
  private cachePrefix = "https://tg-rss.internal/lang/";

  constructor(private d1: D1Database) {}

  async getUserLanguage(userId: number): Promise<Language> {
    const cacheKey = this.cachePrefix + userId;
    const cached = await this.cache.match(cacheKey);
    if (cached) return (await cached.text()) as Language;

    const res = await this.d1.prepare("SELECT language FROM user_settings WHERE user_id = ?").bind(userId).first<{ language: Language }>();
    const lang = res?.language || "zh";
    await this.cache.put(cacheKey, new Response(lang, { headers: { "Cache-Control": "max-age=3600" } }));
    return lang;
  }

  async setUserLanguage(userId: number, language: Language) {
    await this.d1.prepare("INSERT OR REPLACE INTO user_settings (user_id, language) VALUES (?, ?)").bind(userId, language).run();
    await this.cache.delete(this.cachePrefix + userId);
  }

  async addSubscription(userId: number, feedUrl: string, feedTitle: string) {
    await this.d1.prepare("INSERT INTO rss_subscriptions (user_id, feed_url, feed_title, created_at) VALUES (?, ?, ?, ?)").bind(userId, feedUrl, feedTitle, Date.now()).run();
  }

  async removeSubscription(userId: number, feedUrl: string) {
    await this.d1.prepare("DELETE FROM rss_subscriptions WHERE user_id = ? AND feed_url = ?").bind(userId, feedUrl).run();
  }

  async listSubscriptions(userId: number): Promise<RSSSubscription[]> {
    return (await this.d1.prepare("SELECT * FROM rss_subscriptions WHERE user_id = ?").bind(userId).all<RSSSubscription>()).results;
  }

  async updateLastFetch(userId: number, feedUrl: string, lastFetchTime: number, guids: string[]) {
    const current = await this.d1.prepare("SELECT last_item_guid FROM rss_subscriptions WHERE user_id = ? AND feed_url = ?").bind(userId, feedUrl).first<{ last_item_guid: string }>();

    let guidList: string[] = [];
    try {
      guidList = current?.last_item_guid ? JSON.parse(current.last_item_guid) : [];
      if (!Array.isArray(guidList)) guidList = [current!.last_item_guid];
    } catch {
      guidList = [current!.last_item_guid];
    }

    const newList = Array.from(new Set([...guids, ...guidList])).slice(0, 50);
    await this.d1.prepare("UPDATE rss_subscriptions SET last_fetch_time = ?, last_item_guid = ? WHERE user_id = ? AND feed_url = ?").bind(lastFetchTime, JSON.stringify(newList), userId, feedUrl).run();
  }

  parseGuids(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [raw];
    } catch {
      return [raw];
    }
  }

  async getSubscriptionsToUpdate(interval: number): Promise<RSSSubscription[]> {
    return (await this.d1.prepare("SELECT * FROM rss_subscriptions WHERE last_fetch_time IS NULL OR last_fetch_time < ?").bind(Date.now() - interval * 60000).all<RSSSubscription>()).results;
  }
}
