import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { script } = await request.json();

    if (!script || typeof script !== 'string') {
      return NextResponse.json(
        { error: 'Script text is required' },
        { status: 400 }
      );
    }

    // Get Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Initialize Gemini with gemini-2.5-flash-lite model
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    // Create prompt for cleaning script text into image generation prompt and translating to English
    const prompt = `Convert the following script text into a clean image generation prompt in English. Follow these steps:

1. Remove all unnecessary elements:
   - Scene/shot metadata (e.g., "SCENE 1:", "SHOT 1:")
   - Speaker labels (e.g., "John:", "NARRATOR:")
   - Dialogue quotes (keep the content, remove quotes)
   - Dialogue markers (e.g., "says:", "said:", "speaks:")
   - Stage directions in brackets (e.g., [laughs], [whispers])
   - Unnecessary formatting

2. Keep only the essential visual description that would be useful for generating an image

3. Translate the cleaned text to English if it's in another language

4. Make the prompt clear, concise, and suitable for image generation

Return ONLY the final English prompt text, no additional explanation, formatting, or quotation marks.

Script text:
${script}

English image generation prompt:`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const cleanedPrompt = response.text().trim();

      return NextResponse.json({ cleanedPrompt });
    } catch (error: any) {
      console.error('Error calling Gemini API:', error);
      return NextResponse.json(
        { error: `Failed to clean prompt: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error cleaning prompt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clean prompt' },
      { status: 500 }
    );
  }
}

