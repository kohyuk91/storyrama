import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { imageBase64, projectId } = await request.json();

    if (!imageBase64 || !projectId) {
      return NextResponse.json(
        { error: 'imageBase64 and projectId are required' },
        { status: 400 }
      );
    }

    // Get Cloudflare R2 credentials from environment variables
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      return NextResponse.json(
        { error: 'Cloudflare R2 credentials are not configured' },
        { status: 500 }
      );
    }

    // Convert base64 to buffer
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `characters/${projectId}/references/${timestamp}-${randomString}.png`;

    // Configure S3 client for Cloudflare R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      Body: imageBuffer,
      ContentType: 'image/png',
    });

    await s3Client.send(command);

    // Construct public URL
    const imageUrl = `${publicUrl}/${filename}`;

    return NextResponse.json({
      imageUrl,
    });
  } catch (error: any) {
    console.error('Error uploading reference image to R2:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

