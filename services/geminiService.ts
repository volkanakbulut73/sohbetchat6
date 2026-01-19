import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

// Stateless function that creates a client on the fly.
// Accesses process.env.API_KEY directly which is injected by Vite at build time.
export const generateBotResponse = async (
  prompt: string, 
  history: string[] = []
): Promise<string> => {
  try {
    // Coding Guidelines: API key must be obtained exclusively from process.env.API_KEY
    // and used directly in the constructor.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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