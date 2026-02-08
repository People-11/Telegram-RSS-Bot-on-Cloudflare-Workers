import { Database } from "./utils/db";
import { RSSUtil } from "./utils/rss";
import { CommandHandler } from "./handlers/commands";
import { TelegramMessage } from "@codebam/cf-workers-telegram-bot";
import { sendMessage } from "./utils/tgapi";
import { getMessage } from "./utils/i18n";

export default {
  async fetch(request: Request, env: any) {
    if (request.method !== "POST") return new Response("OK");
    const db = new Database(env.DB), rss = new RSSUtil(), cmd = new CommandHandler(db, rss, env.TELEGRAM_BOT_TOKEN);
    const { message } = (await request.json()) as { message?: TelegramMessage };
    if (!message?.text) return new Response("OK");

    const command = message.text.split(" ")[0];
    try {
      if (command === "/start") await cmd.handleStart(message);
      else if (command === "/sub") await cmd.handleSubscribe(message);
      else if (command === "/unsub") await cmd.handleUnsubscribe(message);
      else if (command === "/list") await cmd.handleList(message);
      else if (command === "/lang") await cmd.handleLanguage(message);
    } catch (e) {
      console.error(e);
      const lang = await db.getUserLanguage(message.from?.id || 0);
      await cmd.sendMessage(message.chat.id, getMessage(lang, "error_processing"));
    }
    return new Response("OK");
  },

  async scheduled(_: any, env: any) {
    const db = new Database(env.DB), rss = new RSSUtil();
    const subs = await db.getSubscriptionsToUpdate(env.UPDATE_INTERVAL);
    await Promise.all(subs.map(async (sub) => {
      try {
        const { items } = await rss.fetchFeed(sub.feed_url);
        const newItems = rss.filterNewItems(items, db.parseGuids(sub.last_item_guid), sub.last_fetch_time || 0);
        await db.updateLastFetch(sub.user_id, sub.feed_url, Date.now(), items.map(i => i.guid));
        if (newItems.length > 0) {
          const text = `**${sub.feed_title}**\n${newItems.map(i => rss.formatMessage(i)).join("\n")}`;
          await sendMessage(env.TELEGRAM_BOT_TOKEN, sub.user_id, text);
        }
      } catch (e) { console.error(e); }
    }));
  }
};
