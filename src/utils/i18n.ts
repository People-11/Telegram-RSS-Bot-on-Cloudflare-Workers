export type Language = "zh" | "en";

interface Messages {
  help: string;
  subscribe_success: string;
  subscribe_success_no_articles: string;
  subscribe_failed: string;
  unsubscribe_success: string;
  unsubscribe_failed: string;
  list_empty: string;
  list_header: string;
  url_required: string;
  error_processing: string;
  article_prefix: string;
  chat_not_found: string;
  bot_not_admin: string;
  user_not_admin: string;
  target_invalid: string;
  checking_chat: string;
}

const messages: Record<Language, Messages> = {
  zh: {
    help: `RSS Bot [仓库地址与部署说明](https://github.com/lxl66566/Telegram-RSS-Bot-on-Cloudflare-Workers)

/sub <rss_url> - 订阅一个 RSS 源
/sub <@channel/group> <rss_url> - 为频道或群组订阅
/unsub <rss_url> - 取消订阅 RSS 源
/unsub <@channel/group> <rss_url> - 为频道或群组取消订阅
/list - 列出所有订阅的 RSS 源
/list <@channel/group> - 列出频道或群组的订阅
/start - 显示此帮助信息
/lang - 切换语言 (Switch language)`,
    subscribe_success: "成功订阅 RSS 源：[{title}]({url})\n\n{article}",
    subscribe_success_no_articles: "成功订阅 RSS 源：[{title}]({url})\n\n当前没有任何文章",
    subscribe_failed: "订阅失败：{error}",
    unsubscribe_success: "已取消订阅 RSS 源：{url}",
    unsubscribe_failed: "取消订阅失败：{error}",
    list_empty: "还没有订阅任何 RSS 源",
    list_header: "订阅列表：",
    url_required: "请提供 RSS 源的 URL",
    error_processing: "处理命令时发生错误，请稍后重试",
    article_prefix: "",
    chat_not_found: "找不到目标群组/频道：{error}",
    bot_not_admin: "请先将机器人设为该群组/频道的管理员",
    user_not_admin: "该命令仅限群组/频道的管理员使用",
    target_invalid: "目标必须是频道或（超级）群组",
    checking_chat: "正在校验权限...",
  },
  en: {
    help: `RSS Bot [Repository & Deployment Guide](https://github.com/lxl66566/Telegram-RSS-Bot-on-Cloudflare-Workers)

/sub <rss_url> - Subscribe to RSS feed
/sub <@channel/group> <rss_url> - Subscribe for a channel/group
/unsub <rss_url> - Unsubscribe from RSS feed
/unsub <@channel/group> <rss_url> - Unsubscribe for a channel/group
/list - List all subscribed RSS feeds
/list <@channel/group> - List subscriptions for a channel/group
/start - Show this help message
/lang - Switch language (切换语言)`,
    subscribe_success: "Successfully subscribed to RSS feed: [{title}]({url})\n\n{article}",
    subscribe_success_no_articles: "Successfully subscribed to RSS feed: [{title}]({url})\n\nNo articles available",
    subscribe_failed: "Subscription failed: {error}",
    unsubscribe_success: "Unsubscribed from RSS feed: {url}",
    unsubscribe_failed: "Unsubscribe failed: {error}",
    list_empty: "No RSS feeds subscribed yet",
    list_header: "Subscription list:",
    url_required: "Please provide the RSS feed URL",
    error_processing: "Error processing command, please try again later",
    article_prefix: "",
    chat_not_found: "Target chat not found: {error}",
    bot_not_admin: "Please set the bot as an administrator of the group/channel",
    user_not_admin: "This command is only available for administrators",
    target_invalid: "Target must be a channel or a (super)group",
    checking_chat: "Checking permissions...",
  },
};

export function getMessage(lang: Language, key: keyof Messages, params: Record<string, string> = {}): string {
  let message = messages[lang][key];
  Object.entries(params).forEach(([key, value]) => {
    message = message.replace(`{${key}}`, value);
  });
  return message;
}
