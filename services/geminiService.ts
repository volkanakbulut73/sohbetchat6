import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

// Stateless function that creates a client on the fly.
// Accesses process.env.API_KEY directly which is injected by Vite at build time.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    // Debug log to help identify if key is missing during runtime
    if (!process.env.API_KEY) {
      console.error("GeminiService: API_KEY is missing from process.env. Make sure .env is set and Vite is reloading.");
      return "⚠️ HATA: API Key bulunamadı! Lütfen .env dosyanıza API_KEY ekleyin.";
    }

    // Coding Guidelines: API key must be obtained exclusively from process.env.API_KEY
    // and used directly in the constructor.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Combine history and current prompt into the user content
    const content = `Chat History:\n${history.join('\n')}\n\nUser: ${prompt}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: content,
      config: {
        systemInstruction: "You are a friendly, cute, and helpful AI assistant named Gemini AI inside a retro MIRC-style chatroom. Keep your responses concise (under 300 characters if possible) to fit the chat flow. Use emojis occasionally. If the user asks for help, suggest using chat commands.",
      }
    });

    return response.text || "Biraz kafam karıştı 🤖... tekrar dener misin?";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Return the actual error message to help the user debug
    return `Oof! Beyin devrelerim yandı. (Hata: ${error.message || 'Bilinmiyor'})`;
  }
};