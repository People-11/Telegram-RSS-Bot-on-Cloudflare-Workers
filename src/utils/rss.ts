import Parser from "rss-parser";
import { Language, getMessage } from "./i18n";

export interface FeedItem {
  title: string;
  link: string;
  guid: string;
  pubDate?: string;
  // 不需要 content
  // content?: string
}

interface CacheEntry {
  items: FeedItem[];
  feedTitle: string;
  timestamp: number;
}

export class RSSUtil {
  private parser: Parser;
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_TTL: number;

  constructor(private readonly updateInterval: number) {
    this.CACHE_TTL = updateInterval * 60 * 1000;
    this.parser = new Parser({
      timeout: 5000,
      headers: {
        "User-Agent": "Telegram RSS Bot/1.0",
      },
    });
    this.cache = new Map();
  }

  /**
   * 获取 RSS 源的最新文章
   * @param url - RSS 源的 URL
   * @returns 包含文章和源标题的对象。如果没有获取到标题，则使用 URL 作为标题
   */
  async fetchFeed(url: string): Promise<{ items: FeedItem[]; feedTitle: string }> {
    // 检查缓存
    const cached = this.cache.get(url);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return { items: cached.items, feedTitle: cached.feedTitle };
    }

    try {
      console.log(`Fetching RSS feed from: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Telegram RSS Bot/1.0",
        },
      });

      if (!response.ok) {
        let bodySample = "";
        try {
          const text = await response.text();
          bodySample = text.substring(0, 200);
        } catch (e) {
          bodySample = "Could not read response body";
        }
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}. Body: ${bodySample}`);
      }

      const xml = (await response.text()).trim();
      if (!xml) {
        throw new Error("Empty response body");
      }

      const feed = await this.parser.parseString(xml);
      const items = feed.items.map((item: any) => ({
        title: item.title || "Untitled",
        link: item.link || url,
        guid: item.guid || item.link || "",
        pubDate: item.pubDate,
      }));

      // 更新缓存
      this.cache.set(url, {
        items,
        feedTitle: feed.title?.trim() || url,
        timestamp: now,
      });

      return { items, feedTitle: feed.title?.trim() || url };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching RSS feed from ${url}: ${errorMessage}`);
      throw error;
    }
  }

  formatMessage(item: FeedItem): string {
    return `[${item.title}](${item.link})`;
  }
}
