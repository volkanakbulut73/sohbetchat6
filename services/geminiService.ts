import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

// Stateless function that creates a client on the fly.
// Accesses process.env.API_KEY directly.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    // In Vite with the updated config, process.env.API_KEY is replaced with the string value at build time.
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("GeminiService: API_KEY is missing. Please check your .env file.");
      return "⚠️ HATA: API Key yapılandırılmamış. Lütfen .env dosyasını kontrol edin.";
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    
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
    return `Oof! Beyin devrelerim yandı. (Hata: ${error.message || 'Bilinmiyor'})`;
  }
};