import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

// Stateless function that creates a client on the fly.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    // 1. Try process.env (Standard Node/Vite injected)
    // We check safely to ensure we don't crash if process is somehow undefined
    let apiKey = typeof process !== 'undefined' ? process.env?.API_KEY : undefined;

    // 2. Try Vite's import.meta.env (for VITE_ prefixed keys)
    if (!apiKey) {
       try {
         // @ts-ignore
         apiKey = import.meta.env?.VITE_API_KEY || import.meta.env?.API_KEY;
       } catch (e) {}
    }

    // 3. Try Global Window (Browser Runtime Injection - often used in cloud previews)
    if (!apiKey && typeof window !== 'undefined') {
        const win = window as any;
        apiKey = win.API_KEY || win.VITE_API_KEY || win.process?.env?.API_KEY;
    }

    // Strict check for empty string or undefined
    if (!apiKey || apiKey.trim() === '') {
      console.warn("GeminiService: API_KEY is missing.");
      // Return a friendly in-chat error instead of crashing the app logic
      return "⚠️ Configuration Error: My API_KEY is missing! Please add `API_KEY` to your .env file.";
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