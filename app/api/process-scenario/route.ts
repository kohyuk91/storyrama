import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Shot {
  script: string;
}

interface Scene {
  name: string;
  shots: Shot[];
}

interface Character {
  name: string;
  description?: string;
  clothes?: string;
}

interface ScenarioAnalysis {
  scenes: Scene[];
  characters?: Character[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { scenario } = await request.json();

    if (!scenario || typeof scenario !== 'string') {
      return NextResponse.json(
        { error: 'Scenario text is required' },
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

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Create prompt for scenario analysis
    const prompt = `Analyze the following scenario and extract scenes, shots, and characters (CAST). Return the result as a JSON object with the following structure:

{
  "scenes": [
    {
      "name": "Scene name (e.g., SCENE 1, SCENE 2, or descriptive name)",
      "shots": [
        {
          "script": "Shot description or dialogue"
        }
      ]
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "description": "English sentence(s) that clearly describe the character's likely nationality or country/region, age range, body type, distinctive facial features, hairstyle, and overall vibe",
      "clothes": "English sentence(s) that break down the full outfit with colors, materials, layers, footwear, and notable accessories"
    }
  ]
}

Rules:
1. Break down the scenario into logical scenes
2. Each scene should have a name (use "SCENE 1", "SCENE 2", etc. or descriptive names)
3. Each scene should contain multiple shots
4. Each shot should have a script field with the description, dialogue, or action
5. Extract all characters (CAST) that appear in the scenario
6. For each character, ensure the "description" and "clothes" fields are written in natural English and contain concrete, specific detail. The description MUST include nationality or country/region (or the closest reasonable guess), approximate age range, and notable facial/physical features. The clothes MUST list each visible garment, color palette, materials, and accessories.
7. Be thorough - extract all meaningful scenes, shots, and characters
8. Return ONLY valid JSON, no additional text

Scenario:
${scenario}

Return the JSON:`;

    // Use gemini-2.5-flash for scenario analysis
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract JSON from response (handle cases where there might be markdown code blocks)
      let jsonText = text.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parse JSON
      const analysis: ScenarioAnalysis = JSON.parse(jsonText);

      // Validate structure
      if (!analysis.scenes || !Array.isArray(analysis.scenes)) {
        return NextResponse.json(
          { error: 'Invalid response format: scenes array is missing' },
          { status: 500 }
        );
      }

      // Validate each scene
      for (const scene of analysis.scenes) {
        if (!scene.name || !scene.shots || !Array.isArray(scene.shots)) {
          return NextResponse.json(
            { error: 'Invalid response format: scene structure is invalid' },
            { status: 500 }
          );
        }

        for (const shot of scene.shots) {
          if (!shot.script) {
            return NextResponse.json(
              { error: 'Invalid response format: shot script is missing' },
              { status: 500 }
            );
          }
        }
      }

      // Validate characters if present
      if (analysis.characters && Array.isArray(analysis.characters)) {
        for (const character of analysis.characters) {
          if (!character.name) {
            return NextResponse.json(
              { error: 'Invalid response format: character name is missing' },
              { status: 500 }
            );
          }
        }
      }

      return NextResponse.json({ analysis });
    } catch (error: any) {
      console.error('Error calling Gemini API:', error);
      return NextResponse.json(
        { error: `Failed to process scenario: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error processing scenario:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process scenario' },
      { status: 500 }
    );
  }
}

