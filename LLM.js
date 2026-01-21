import { GoogleGenAI } from "@google/genai";
import readlineSync from "readline-sync";
import dotenv from "dotenv";
dotenv.config();

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function startChat() {
  // Create chat session once with initial history
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    history: [],
  });

  console.log("Chat started! Type 'exit' to quit.\n");

  while (true) {
    const userPrompt = readlineSync.question("You: ");

    if (userPrompt.toLowerCase() === 'exit') {
      console.log("Goodbye!");
      break;
    }

    try {
      // Send message using the chat session
      const response = await chat.sendMessage({
        message: userPrompt,
      });
      console.log("\nAI: " + response.text + "\n");
    } catch (error) {
      console.error("Error:", error.message);
    }
  }
}

startChat();