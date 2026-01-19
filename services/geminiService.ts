import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

// Stateless function that creates a client on the fly.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    // Attempt to retrieve the API key from multiple potential sources
    let apiKey: string | undefined = process.env.API_KEY;

    // Check Vite-specific env vars if process.env.API_KEY is missing
    if (!apiKey) {
        apiKey = (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.API_KEY;
    }

    // Check runtime global scope (e.g. injected by container or browser polyfill)
    if (!apiKey && typeof window !== 'undefined') {
        apiKey = (window as any).process?.env?.API_KEY;
    }

    // Strict check for empty string or undefined
    if (!apiKey || apiKey.trim() === '') {
      console.warn("GeminiService: API_KEY is missing.");
      return "⚠️ Configuration Error: API_KEY is missing. Please add `API_KEY=your_key` or `VITE_API_KEY=your_key` to your .env file.";
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // Combine history and current prompt into the user content
    // We limit history to avoid token limits in a simple implementation
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