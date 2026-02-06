import { TelegramMessage as Message } from "@codebam/cf-workers-telegram-bot";
import { Database } from "../utils/db";
import { RSSUtil } from "../utils/rss";
import { sendMessage, getChat, getChatAdministrators, getMe } from "../utils/tgapi";
import { Language, getMessage } from "../utils/i18n";

export class CommandHandler {
  constructor(private db: Database, private rssUtil: RSSUtil, private token: string) {}

  async sendMessage(chatId: number | string, text: string, options?: Record<string, any>) {
    return await sendMessage(this.token, chatId, text, options);
  }

  /**
   * 校验目标群组/频道的权限
   * @returns 返回目标 chat_id，如果校验失败则返回 null
   */
  private async checkChat(message: Message, chatIdentifier: string, lang: Language): Promise<number | null> {
    const userId = message.from?.id;
    if (!userId) return null;

    // 1. 获取 Chat 信息
    const chatRes = await getChat(this.token, chatIdentifier);
    if (!chatRes.ok) {
      await this.sendMessage(message.chat.id, getMessage(lang, "chat_not_found", { error: chatRes.description || "Unknown" }));
      return null;
    }

    const targetChat = chatRes.result;
    // 允许的类型：channel, group, supergroup
    if (!["channel", "group", "supergroup"].includes(targetChat.type)) {
      await this.sendMessage(message.chat.id, getMessage(lang, "target_invalid"));
      return null;
    }

    const targetChatId = targetChat.id;

    // 2. 获取管理员列表
    const adminRes = await getChatAdministrators(this.token, targetChatId);
    if (!adminRes.ok) {
      // 如果机器人不是管理员，通常调用此接口会失败或返回错误
      await this.sendMessage(message.chat.id, getMessage(lang, "bot_not_admin"));
      return null;
    }

    const admins: any[] = adminRes.result;
    const adminIds = admins.map((a) => a.user.id);

    // 3. 校验机器人是否是管理员
    const meRes = await getMe(this.token);
    if (!meRes.ok || !adminIds.includes(meRes.result.id)) {
      await this.sendMessage(message.chat.id, getMessage(lang, "bot_not_admin"));
      return null;
    }

    // 4. 校验发送者是否是管理员
    if (!adminIds.includes(userId)) {
      await this.sendMessage(message.chat.id, getMessage(lang, "user_not_admin"));
      return null;
    }

    return targetChatId;
  }

  async handleStart(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const lang = await this.db.getUserLanguage(userId);
    const helpText = getMessage(lang, "help");
    await this.sendMessage(message.chat.id, helpText, { disable_web_page_preview: true });
  }

  async handleLanguage(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const currentLang = await this.db.getUserLanguage(userId);
    const newLang: Language = currentLang === "zh" ? "en" : "zh";
    await this.db.setUserLanguage(userId, newLang);

    const helpText = getMessage(newLang, "help");
    await this.sendMessage(message.chat.id, helpText, { disable_web_page_preview: true });
  }

  async handleSubscribe(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const lang = await this.db.getUserLanguage(userId);
    const args = message.text?.split(/\s+/) || [];
    let targetId: number | string = message.chat.id;
    let feedUrl = "";

    if (args.length === 2) {
      feedUrl = args[1];
    } else if (args.length === 3) {
      // /sub @channel url
      const chatIdentifier = args[1];
      const verifiedId = await this.checkChat(message, chatIdentifier, lang);
      if (!verifiedId) return;
      targetId = verifiedId;
      feedUrl = args[2];
    } else {
      await this.sendMessage(message.chat.id, getMessage(lang, "help"));
      return;
    }

    try {
      const { items, feedTitle } = await this.rssUtil.fetchFeed(feedUrl);
      await this.db.addSubscription(targetId as number, feedUrl, feedTitle);

      if (items.length > 0) {
        await this.db.updateLastFetch(targetId as number, feedUrl, Date.now(), items[0].guid);
        const displayItems = items.slice(0, 5);
        const articlesList = displayItems.map((item) => this.rssUtil.formatMessage(item)).join("\n");
        const aggregatedArticle = `**${feedTitle}**\n${articlesList}`;

        await this.sendMessage(
          message.chat.id,
          getMessage(lang, "subscribe_success", { title: feedTitle, url: feedUrl, article: aggregatedArticle })
        );
      } else {
        await this.sendMessage(message.chat.id, getMessage(lang, "subscribe_success_no_articles", { title: feedTitle, url: feedUrl }));
      }
    } catch (error) {
      await this.sendMessage(message.chat.id, getMessage(lang, "subscribe_failed", { error: error instanceof Error ? error.message : "Unknown error" }));
    }
  }

  async handleUnsubscribe(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const lang = await this.db.getUserLanguage(userId);
    const args = message.text?.split(/\s+/) || [];
    let targetId: number | string = message.chat.id;
    let feedUrl = "";

    if (args.length === 2) {
      feedUrl = args[1];
    } else if (args.length === 3) {
      const chatIdentifier = args[1];
      const verifiedId = await this.checkChat(message, chatIdentifier, lang);
      if (!verifiedId) return;
      targetId = verifiedId;
      feedUrl = args[2];
    } else {
      await this.sendMessage(message.chat.id, getMessage(lang, "help"));
      return;
    }

    try {
      await this.db.removeSubscription(targetId as number, feedUrl);
      await this.sendMessage(message.chat.id, getMessage(lang, "unsubscribe_success", { url: feedUrl }));
    } catch (error) {
      await this.sendMessage(message.chat.id, getMessage(lang, "unsubscribe_failed", { error: error instanceof Error ? error.message : "Unknown error" }));
    }
  }

  async handleList(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const lang = await this.db.getUserLanguage(userId);
    const args = message.text?.split(/\s+/) || [];
    let targetId: number | string = message.chat.id;

    if (args.length === 2) {
      const chatIdentifier = args[1];
      const verifiedId = await this.checkChat(message, chatIdentifier, lang);
      if (!verifiedId) return;
      targetId = verifiedId;
    }

    const subscriptions = await this.db.listSubscriptions(targetId as number);
    if (subscriptions.length === 0) {
      await this.sendMessage(message.chat.id, getMessage(lang, "list_empty"));
      return;
    }

    const subscriptionList = subscriptions.map((sub, index) => `${index + 1}. [${sub.feed_title}](${sub.feed_url})`).join("\n");
    await this.sendMessage(message.chat.id, `${getMessage(lang, "list_header")}\n${subscriptionList}`);
  }
}
