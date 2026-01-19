import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

/**
 * Helper to retrieve the API Key from various possible injection points.
 * Checks process.env, Vite's import.meta.env, and the global window object.
 */
export const getApiKey = (): string | undefined => {
  // 1. Try safe process.env access using bracket notation to bypass some bundler replacements
  let key = typeof process !== 'undefined' ? process.env?.['API_KEY'] : undefined;

  // 2. Try Standard Vite Injection
  if (!key) {
      try {
        // @ts-ignore
        key = import.meta.env?.VITE_API_KEY || import.meta.env?.API_KEY;
      } catch {}
  }

  // 3. Try Global Window (Runtime Injection for Previews/AI Studio)
  if (!key && typeof window !== 'undefined') {
      const win = window as any;
      key = win.API_KEY || win.VITE_API_KEY || win.process?.env?.API_KEY;
  }
  
  return key;
};

// Stateless function that creates a client on the fly.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    const apiKey = getApiKey();

    if (!apiKey || apiKey.trim() === '') {
      console.warn("GeminiService: API_KEY is missing.");
      return "⚠️ Configuration Error: My API_KEY is missing! If you are in AI Studio, please click 'Select API Key' on the login screen, or add `API_KEY` to your .env file.";
    }

    // Always create a fresh instance to ensure we use the latest key
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // Combine history and current prompt into the user content
    const limitedHistory = history.slice(-10);
    const content = `Previous Chat:\n${limitedHistory.join('\n')}\n\nUser: ${prompt}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: content,
      config: {
        systemInstruction: "You are a friendly, cute, and helpful AI assistant named Gemini AI inside a retro MIRC-style chatroom. Keep your responses concise (under 300 characters if possible) to fit the chat flow. Use emojis occasionally. If the user asks for help, suggest using chat commands like /nick or /me.",
      }
    });

    return response.text || "I'm not sure what to say... 🤖";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `⚠️ Bot Error: ${error.message || 'Unknown error occurred.'}`;
  }
};