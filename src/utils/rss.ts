import Parser from "rss-parser";

export interface FeedItem {
  title: string;
  link: string;
  pubDate?: string;
  guid: string;
}

export class RSSUtil {
  private parser = new Parser();
  constructor(private userAgent: string = "Telegram RSS Bot/1.0") {}

  async fetchFeed(url: string): Promise<{ items: FeedItem[]; feedTitle: string }> {
    const res = await fetch(url, { headers: { "User-Agent": this.userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);

    const xml = await res.text();
    const feed = await this.parser.parseString(xml);
    
    const items = (feed.items || []).map((i: any) => ({
      title: i.title || "No Title",
      link: i.link || "",
      pubDate: i.pubDate || i.isoDate,
      guid: i.guid || i.id || i.link || "",
    }));

    return { items, feedTitle: feed.title || "Untitled Feed" };
  }

  filterNewItems(items: FeedItem[], historyGuids: string[], lastFetchTime: number): FeedItem[] {
    return items.filter((item) => {
      const isNewId = !historyGuids.includes(item.guid);
      const pubTime = item.pubDate ? new Date(item.pubDate).getTime() : 0;
      return isNewId && (!pubTime || pubTime > lastFetchTime);
    });
  }

  formatMessage(item: FeedItem): string {
    return `[${item.title}](${item.link})`;
  }
}
