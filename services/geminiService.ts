import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

/**
 * Helper to retrieve the API Key from various possible injection points.
 * Checks process.env.API_KEY.
 */
export const getApiKey = (): string | undefined => {
  // Build-time Replacement (process.env.API_KEY)
  // CRITICAL: Must use DOT notation (process.env.API_KEY) for Vite to replace it with the string literal.
  // Using process.env['API_KEY'] prevents replacement and fails in production.
  try {
    // @ts-ignore
    const buildKey = process.env.API_KEY;
    if (buildKey) return buildKey;
  } catch {}

  return undefined;
};

// Stateless function that creates a client on the fly.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    // @ts-ignore
    const apiKey = process.env.API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      console.warn("GeminiService: API_KEY is missing.");
      return "⚠️ Configuration Error: My API_KEY is missing! If you are on Vercel, please add `VITE_API_KEY` to your Environment Variables and Redeploy.";
    }

    // Always create a fresh instance to ensure we use the latest key
    // @ts-ignore
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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