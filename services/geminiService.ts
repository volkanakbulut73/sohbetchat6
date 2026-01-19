import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

// Stateless function that creates a client on the fly.
// Accesses process.env.API_KEY directly.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    // Attempt to retrieve key. 
    // We check window.process as a fallback for some browser environments where standard process.env might be shimmed differently.
    const apiKey = process.env.API_KEY || (window as any).process?.env?.API_KEY;

    if (!apiKey) {
      console.warn("GeminiService: API_KEY appears missing. Attempts to call API might fail if not injected by the platform.");
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