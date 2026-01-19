import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

/**
 * Helper to retrieve the API Key.
 * Checks process.env.API_KEY which is replaced at build time.
 */
export const getApiKey = (): string | undefined => {
  try {
    // @ts-ignore
    return process.env.API_KEY;
  } catch {
    return undefined;
  }
};

// Stateless function that creates a client on the fly.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    // Get the key using the robust helper function
    const apiKey = getApiKey();

    if (!apiKey || apiKey.trim() === '') {
      console.warn("GeminiService: API_KEY is missing.");
      return "⚠️ Configuration Error: My API_KEY is missing! If you are on Vercel, please add `VITE_API_KEY` to your Environment Variables settings and Redeploy.";
    }

    // Initialize with the retrieved apiKey variable
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