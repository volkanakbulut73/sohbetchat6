import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

// Stateless function that creates a client on the fly.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
    // This variable is injected by Vite at build time.
    const apiKey = process.env.API_KEY;

    // Strict check for empty string or undefined
    if (!apiKey || apiKey.trim() === '') {
      console.error("GeminiService: API_KEY is missing. Please set API_KEY or VITE_API_KEY in your .env file.");
      return "⚠️ Configuration Error: API_KEY is missing. Please add `API_KEY=your_key` to your .env file and restart.";
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