import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { prompt, aspect_ratio } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Use provided aspect_ratio or default to '1:1'
    const imageAspectRatio = aspect_ratio || '1:1';
    
    // Validate aspect_ratio
    const validAspectRatios = ['16:9', '1:1', '9:16'];
    if (!validAspectRatios.includes(imageAspectRatio)) {
      return NextResponse.json(
        { error: 'Invalid aspect_ratio. Must be one of: 16:9, 1:1, 9:16' },
        { status: 400 }
      );
    }

    // Convert aspect_ratio to width and height
    // BFL API typically uses width and height instead of aspect_ratio
    let width: number;
    let height: number;
    
    switch (imageAspectRatio) {
      case '16:9':
        width = 1024;
        height = 576; // 1024 * 9 / 16 = 576
        break;
      case '1:1':
        width = 1024;
        height = 1024;
        break;
      case '9:16':
        width = 576; // 1024 * 9 / 16 = 576
        height = 1024;
        break;
      default:
        width = 1024;
        height = 1024;
    }

    // Get BFL API key
    const apiKey = process.env.BFL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'BFL_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Step 1: Create image generation task
    // Reference: https://docs.bfl.ai/quick_start/generating_images
    let pollingUrl: string | null = null;
    
    try {
      console.log('Creating image generation task...');
      
      // Submit generation request using BFL API
      const endpoint = 'https://api.bfl.ai/v1/flux-dev';
      
      console.log('Submitting generation request...');
      
      const createResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-key': apiKey,
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          width: width,
          height: height,
        }),
      });

      const responseText = await createResponse.text();
      console.log(`Create task response status:`, createResponse.status);
      console.log(`Create task response body:`, responseText.substring(0, 500));

      if (!createResponse.ok) {
        let errorData: any;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText };
        }
        
        const errorMessage = errorData.error?.message || errorData.message || errorData.detail || 'Failed to create task';
        console.error('Error creating task:', errorMessage);
        return NextResponse.json(
          { 
            error: 'Failed to create generation task',
            message: errorMessage,
            details: errorData,
          },
          { status: createResponse.status || 500 }
        );
      }

      const createData = JSON.parse(responseText);
      console.log('Task created:', createData.id);
      
      // Extract task ID and polling URL from response
      const requestId = createData.id;
      pollingUrl = createData.polling_url;
      
      if (!requestId || !pollingUrl) {
        return NextResponse.json(
          { 
            error: 'Invalid response from API',
            message: 'Response missing id or polling_url',
            details: createData,
          },
          { status: 500 }
        );
      }

    } catch (error: any) {
      console.error('Error creating task:', error);
      return NextResponse.json(
        { 
          error: 'Failed to create generation task',
          message: error.message,
        },
        { status: 500 }
      );
    }

    // Step 2: Poll for result using polling_url
    // Reference: https://docs.bfl.ai/quick_start/generating_images
    let imageUrl: string | null = null;
    const maxAttempts = 60; // Maximum polling attempts (30 seconds with 0.5s interval)
    const pollInterval = 500; // 0.5 seconds between polls (as per documentation)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        console.log(`Polling for result (attempt ${attempt + 1}/${maxAttempts})...`);
        
        const resultResponse = await fetch(pollingUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-key': apiKey,
          },
        });

        const resultData = await resultResponse.json();
        console.log(`Result status: ${resultData.status}`);

        if (resultData.status === 'Ready') {
          // Extract image URL from result
          // According to docs: result.sample is a signed URL
          if (resultData.result && resultData.result.sample) {
            imageUrl = resultData.result.sample;
            console.log('Image URL received:', imageUrl);
            break;
          } else {
            console.log('No sample URL in result:', JSON.stringify(resultData, null, 2));
          }
        } else if (resultData.status === 'Error' || resultData.status === 'Failed') {
          return NextResponse.json(
            { 
              error: 'Image generation failed',
              message: resultData.details?.message || 'Generation task failed',
              details: resultData.details,
            },
            { status: 500 }
          );
        }
        // Continue polling for 'Pending', 'Request Moderated', 'Content Moderated'
      } catch (error: any) {
        console.error(`Error polling result (attempt ${attempt + 1}):`, error.message);
        if (attempt === maxAttempts - 1) {
          return NextResponse.json(
            { 
              error: 'Failed to get generation result',
              message: error.message,
            },
            { status: 500 }
          );
        }
      }
    }

    if (!imageUrl) {
      return NextResponse.json(
        { 
          error: 'Image generation timeout',
          message: 'Image generation took too long. Please try again.',
        },
        { status: 504 }
      );
    }

    // Step 3: Download image from signed URL and convert to base64
    // Note: Signed URLs are only valid for 10 minutes
    try {
      console.log('Downloading image from signed URL...');
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        return NextResponse.json(
          { 
            error: 'Failed to download image',
            message: `Failed to download from signed URL: ${imageResponse.status}`,
          },
          { status: 500 }
        );
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');
      
      console.log('Image downloaded and converted to base64');

      return NextResponse.json({
        imageBase64,
      });
    } catch (error: any) {
      console.error('Error downloading image:', error);
      return NextResponse.json(
        { 
          error: 'Failed to download image',
          message: error.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
