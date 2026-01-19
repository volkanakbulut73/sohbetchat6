import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

const getApiKey = (): string | undefined => {
  // 1. Check if Vite replaced it during build (or Node env)
  // We use a safe check for 'process' to avoid ReferenceErrors in strict browser environments
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  // 2. Check explicit window polyfill (common in web containers/cloud IDEs)
  if (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) {
    return (window as any).process.env.API_KEY;
  }
  return undefined;
};

// Stateless function that creates a client on the fly.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    const apiKey = getApiKey();

    // Strict check for empty string or undefined
    if (!apiKey || apiKey.trim() === '') {
      console.error("GeminiService: API_KEY is missing/empty. Checked process.env and window.process.env.");
      return "⚠️ SYSTEM ERROR: API Key is missing. Please configure the API_KEY environment variable.";
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