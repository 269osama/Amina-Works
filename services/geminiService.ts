import { GoogleGenAI, Type } from "@google/genai";
import { Subtitle, GenerationResult } from "../types";
import { parseTime, processMediaForGemini } from "../utils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Using Flash for faster turnaround on media processing.
const MODEL_NAME = 'gemini-2.5-flash'; 

// Helper to clean JSON output (remove markdown blocks if present)
const cleanJson = (text: string): string => {
  let clean = text.replace(/```json/g, '').replace(/```/g, '');
  return clean.trim();
};

export const generateSubtitlesFromMedia = async (
  mediaFile: File,
  onProgress: (status: string) => void
): Promise<GenerationResult> => {
  try {
    onProgress("Extracting & compressing audio...");
    
    // Optimize media: Extract audio -> Downsample to 16kHz -> Mono -> WAV
    const { data: base64Data, mimeType } = await processMediaForGemini(mediaFile);

    onProgress("Gemini is analyzing speech & language...");

    // Prompt updated to request Language Detection explicitly in the JSON response
    const prompt = `
      Analyze the audio and generate professional subtitles (SRT style).
      
      STRICT GUIDELINES:
      1. LANGUAGE: Detect the spoken language automatically. Return the language name in the JSON.
      2. LENGTH: Maximum 2 lines per subtitle. Max 42 chars per line.
      3. TIMING: Use standard SRT format timestamps (00:00:00,000).
      
      Return a JSON OBJECT with this structure:
      {
        "detectedLanguage": "English", 
        "subtitles": [
          {
            "startTime": "00:00:00,000",
            "endTime": "00:00:00,000",
            "speaker": "Speaker Name",
            "text": "Subtitle text here" 
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING },
            subtitles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  startTime: { type: Type.STRING },
                  endTime: { type: Type.STRING },
                  speaker: { type: Type.STRING },
                  text: { type: Type.STRING },
                },
                required: ["startTime", "endTime", "text"]
              }
            }
          }
        }
      }
    });

    const text = response.text || "{}";
    const data = JSON.parse(cleanJson(text));
    
    const rawSubtitles = data.subtitles || [];
    const detectedLang = data.detectedLanguage || "Unknown";

    // Transform to our internal format
    const subtitles: Subtitle[] = rawSubtitles.map((item: any, index: number) => ({
      id: `auto-${index}-${Date.now()}`,
      startTime: parseTime(item.startTime),
      endTime: parseTime(item.endTime),
      text: item.text,
      speaker: item.speaker || 'Unknown',
      confidence: 0.95 
    }));

    return { subtitles, detectedLanguage: detectedLang };

  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw new Error("Failed to generate subtitles. Please check if the file is valid.");
  }
};

export const translateSubtitlesWithGemini = async (
  subtitles: Subtitle[],
  targetLanguage: string
): Promise<Subtitle[]> => {
  try {
    const subtitlesToTranslate = subtitles.map(s => ({ id: s.id, text: s.text }));
    
    const prompt = `
      Translate the following subtitle text to ${targetLanguage}.
      Rules:
      1. Keep the same meaning and tone.
      2. Keep the translation concise (max 2 lines, max 42 chars/line if possible).
      3. Return a JSON array of objects with 'id' and 'translatedText'.
      
      Input:
      ${JSON.stringify(subtitlesToTranslate)}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              translatedText: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text || "[]";
    const translations = JSON.parse(cleanJson(text));
    
    const translationMap = new Map<string, string>(translations.map((t: any) => [t.id, t.translatedText]));

    return subtitles.map(sub => ({
      ...sub,
      originalText: sub.originalText || sub.text, // Preserve the very first original text
      text: translationMap.get(sub.id) || sub.text // Apply translation if found
    }));

  } catch (error) {
    console.error("Gemini Translation Error:", error);
    throw new Error("Translation failed. Please try again.");
  }
};