import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

// Stateless function that creates a client on the fly or uses a passed instance logic if preferred.
// For simplicity in this module, we instantiate per request or rely on the caller to manage rate limits.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = [],
  apiKey?: string
): Promise<string> => {
  if (!apiKey) {
    return "I'm currently offline (API Key missing). 😴";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const context = `
      You are a friendly, cute, and helpful AI assistant named Gemini AI inside a retro MIRC-style chatroom.
      Keep your responses concise (under 300 characters if possible) to fit the chat flow.
      Use emojis occasionally.
      If the user asks for help, suggest using chat commands.
    `;

    const modelInput = `${context}\n\nChat History:\n${history.join('\n')}\n\nUser: ${prompt}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: modelInput,
    });

    return response.text || "I'm feeling a bit glitchy today 🤖... try again?";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Oof! My brain circuits are overloaded. (API Error)";
  }
};