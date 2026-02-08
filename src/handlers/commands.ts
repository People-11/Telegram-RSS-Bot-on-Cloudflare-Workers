import { TelegramMessage as Message } from "@codebam/cf-workers-telegram-bot";
import { Database } from "../utils/db";
import { RSSUtil } from "../utils/rss";
import { sendMessage, getChat, getChatAdministrators, getMe } from "../utils/tgapi";
import { getMessage } from "../utils/i18n";

export class CommandHandler {
  constructor(private db: Database, private rss: RSSUtil, private token: string) {}

  async sendMessage(id: number | string, text: string, opt?: any) { return sendMessage(this.token, id, text, opt); }

  private async checkChat(msg: Message, chatIdent: string, lang: any): Promise<number | null> {
    const uid = msg.from?.id;
    const res = await getChat(this.token, chatIdent);
    if (!res.ok) { await this.sendMessage(msg.chat.id, getMessage(lang, "chat_not_found", { error: res.description || "" })); return null; }
    
    const chat = res.result;
    if (!["channel", "group", "supergroup"].includes(chat.type)) { await this.sendMessage(msg.chat.id, getMessage(lang, "target_invalid")); return null; }

    const adminRes = await getChatAdministrators(this.token, chat.id);
    if (!adminRes.ok) { await this.sendMessage(msg.chat.id, getMessage(lang, "bot_not_admin")); return null; }

    const adminIds = (adminRes.result as any[]).map(a => a.user.id);
    const me = await getMe(this.token);
    if (!me.ok || !adminIds.includes(me.result.id)) { await this.sendMessage(msg.chat.id, getMessage(lang, "bot_not_admin")); return null; }
    if (!adminIds.includes(uid!)) { await this.sendMessage(msg.chat.id, getMessage(lang, "user_not_admin")); return null; }

    return chat.id;
  }

  private async getCtx(msg: Message) {
    const uid = msg.from?.id || 0;
    const lang = await this.db.getUserLanguage(uid);
    const args = msg.text?.split(/\s+/) || [];
    return { uid, lang, args };
  }

  async handleStart(msg: Message) {
    const { lang } = await this.getCtx(msg);
    await this.sendMessage(msg.chat.id, getMessage(lang, "help"), { disable_web_page_preview: true });
  }

  async handleLanguage(msg: Message) {
    const { uid, lang } = await this.getCtx(msg);
    const next = lang === "zh" ? "en" : "zh";
    await this.db.setUserLanguage(uid, next);
    await this.sendMessage(msg.chat.id, getMessage(next, "help"), { disable_web_page_preview: true });
  }

  async handleSubscribe(msg: Message) {
    const { lang, args } = await this.getCtx(msg);
    let targetId: number | string = msg.chat.id, url = args[1];

    if (args.length === 3) {
      const vid = await this.checkChat(msg, args[1], lang);
      if (!vid) return;
      targetId = vid; url = args[2];
    } else if (args.length !== 2) return this.handleStart(msg);

    try {
      const { items, feedTitle: title } = await this.rss.fetchFeed(url);
      await this.db.addSubscription(targetId as number, url, title);
      await this.db.updateLastFetch(targetId as number, url, Date.now(), items.map(i => i.guid));
      
      const art = items.length ? `**${title}**\n${items.slice(0, 5).map(i => this.rss.formatMessage(i)).join("\n")}` : "";
      const key = items.length ? "subscribe_success" : "subscribe_success_no_articles";
      await this.sendMessage(msg.chat.id, getMessage(lang, key, { title, url, article: art }));
    } catch (e: any) { await this.sendMessage(msg.chat.id, getMessage(lang, "subscribe_failed", { error: e.message })); }
  }

  async handleUnsubscribe(msg: Message) {
    const { lang, args } = await this.getCtx(msg);
    let targetId: number | string = msg.chat.id, url = args[1];
    if (args.length === 3) {
      const vid = await this.checkChat(msg, args[1], lang);
      if (!vid) return;
      targetId = vid; url = args[2];
    } else if (args.length !== 2) return this.handleStart(msg);

    try {
      await this.db.removeSubscription(targetId as number, url);
      await this.sendMessage(msg.chat.id, getMessage(lang, "unsubscribe_success", { url }));
    } catch (e: any) { await this.sendMessage(msg.chat.id, getMessage(lang, "unsubscribe_failed", { error: e.message })); }
  }

  async handleList(msg: Message) {
    const { lang, args } = await this.getCtx(msg);
    let tid = msg.chat.id;
    if (args.length === 2) {
      const vid = await this.checkChat(msg, args[1], lang);
      if (!vid) return;
      tid = vid;
    }
    const subs = await this.db.listSubscriptions(tid as number);
    if (!subs.length) return this.sendMessage(msg.chat.id, getMessage(lang, "list_empty"));
    const list = subs.map((s, i) => `${i + 1}. [${s.feed_title}](${s.feed_url})`).join("\n");
    await this.sendMessage(msg.chat.id, `${getMessage(lang, "list_header")}\n${list}`);
  }
}
