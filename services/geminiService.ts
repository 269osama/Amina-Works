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

// --- BATCH AUDIO GENERATION HELPERS ---

/**
 * Splits text into chunks that are safe for TTS API limits (~300 chars is safe for quality/speed per request).
 * Respects sentence boundaries.
 */
const splitTextIntoChunks = (text: string, maxChunkSize = 300): string[] => {
  const chunks: string[] = [];
  let currentChunk = '';
  
  // Split by sentence ending punctuation
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  
  return chunks;
};

// Helper to concatenate audio buffers
const concatenateAudioBuffers = (buffers: ArrayBuffer[]): ArrayBuffer => {
    let totalLength = 0;
    buffers.forEach(buffer => totalLength += buffer.byteLength);
    const tmp = new Uint8Array(totalLength);
    let offset = 0;
    buffers.forEach(buffer => {
        tmp.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    });
    return tmp.buffer;
};

// Create a WAV header for raw PCM data (Assuming 24kHz Mono from Gemini for this example, or standardizing)
// NOTE: Gemini TTS output format is typically raw. We wrap it to make it playable.
const createWavHeader = (dataLength: number, sampleRate = 24000) => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    return buffer;
};

export const generateDubbedAudio = async (
    text: string, 
    onProgress?: (percentage: number) => void
): Promise<string> => {
    try {
        const chunks = splitTextIntoChunks(text);
        const audioBuffers: ArrayBuffer[] = [];
        
        console.log(`Starting batch TTS for ${text.length} chars in ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // Report progress
            if (onProgress) {
                onProgress(Math.round(((i) / chunks.length) * 100));
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: {
                    parts: [{ text: chunk }]
                },
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' }
                        }
                    }
                }
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const binaryString = atob(base64Audio);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let j = 0; j < len; j++) {
                    bytes[j] = binaryString.charCodeAt(j);
                }
                audioBuffers.push(bytes.buffer);
            }
            
            // Tiny delay to be nice to the API
            await new Promise(r => setTimeout(r, 100));
        }

        if (onProgress) onProgress(100);

        if (audioBuffers.length === 0) {
            throw new Error("No audio generated from batches.");
        }

        // Concatenate all chunks
        const rawPcmData = concatenateAudioBuffers(audioBuffers);
        
        // Add WAV header so browser understands it (Gemini TTS default is often 24kHz)
        const header = createWavHeader(rawPcmData.byteLength, 24000); 
        const finalBuffer = concatenateAudioBuffers([header, rawPcmData]);

        const blob = new Blob([finalBuffer], { type: 'audio/wav' });
        return URL.createObjectURL(blob);

    } catch (error) {
        console.error("Dubbing Error:", error);
        throw new Error("Failed to generate audio dub.");
    }
};