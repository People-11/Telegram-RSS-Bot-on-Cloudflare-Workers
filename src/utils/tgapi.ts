import telegramifyMarkdown from "telegramify-markdown";

async function tgFetch(bot_token: string, method: string, body?: any) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${bot_token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data: any = await response.json();
    if (!response.ok) console.error(`Error in ${method}: ${response.status} - ${JSON.stringify(data)}`);
    return data;
  } catch (error) {
    console.error(`Fetch error in ${method}:`, error);
    return { ok: false, description: String(error) };
  }
}

export const sendMessage = (bot_token: string, chatId: number | string, text: string, options?: any) =>
  tgFetch(bot_token, "sendMessage", {
    chat_id: chatId,
    text: telegramifyMarkdown(text, "escape"),
    parse_mode: options?.parse_mode || "MarkdownV2",
    ...options,
  });

export const getChat = (bot_token: string, chatId: number | string) => 
  tgFetch(bot_token, "getChat", { chat_id: chatId });

export const getChatAdministrators = (bot_token: string, chatId: number | string) => 
  tgFetch(bot_token, "getChatAdministrators", { chat_id: chatId });

export const getMe = (bot_token: string) => 
  tgFetch(bot_token, "getMe");
