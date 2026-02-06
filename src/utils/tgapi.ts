import telegramifyMarkdown from "telegramify-markdown";

async function sendMessage(bot_token: string, chatId: number | string, text: string, options?: Record<string, any>) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramifyMarkdown(text, "escape"),
        parse_mode: options?.parse_mode || "MarkdownV2",
        ...options,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error in sendMessage: ${response.status} - ${errorText}`);
    }

    return response;
  } catch (error) {
    console.error("Fetch error in sendMessage:", error);
  }
}

async function getChat(bot_token: string, chatId: number | string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${bot_token}/getChat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
      }),
    });
    const data: any = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch error in getChat:", error);
    return { ok: false, description: String(error) };
  }
}

async function getChatAdministrators(bot_token: string, chatId: number | string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${bot_token}/getChatAdministrators`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
      }),
    });
    const data: any = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch error in getChatAdministrators:", error);
    return { ok: false, description: String(error) };
  }
}

async function getMe(bot_token: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    const data: any = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch error in getMe:", error);
    return { ok: false, description: String(error) };
  }
}

export { sendMessage, getChat, getChatAdministrators, getMe };
