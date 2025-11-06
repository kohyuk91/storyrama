'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';

interface ShotData {
  id: string;
  scene_id: string;
  order_index: number;
  image_url: string | null;
  script: string | null;
  created_at: string;
  updated_at: string;
}

interface SceneData {
  id: string;
  project_id: string;
  name: string;
  order_index: number;
}

export default function ShotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const projectId = params.id as string;
  const sceneId = params.sceneId as string;
  const shotId = params.shotId as string;
  
  const [shot, setShot] = useState<ShotData | null>(null);
  const [scene, setScene] = useState<SceneData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchShotAndScene = async () => {
      if (!user?.id || !shotId || !sceneId) {
        setIsLoading(false);
        setError('Missing required parameters');
        return;
      }

      try {
        setIsLoading(true);

        // Fetch shot
        const { data: shotData, error: shotError } = await supabase
          .from('shots')
          .select('*')
          .eq('id', shotId)
          .single();

        if (shotError) {
          throw shotError;
        }

        if (!shotData) {
          setError('Shot not found');
          setIsLoading(false);
          return;
        }

        // Verify shot belongs to the scene
        if (shotData.scene_id !== sceneId) {
          setError('Shot does not belong to this scene');
          setIsLoading(false);
          return;
        }

        setShot(shotData);
        setPrompt(shotData.script || '');

        // Fetch scene
        const { data: sceneData, error: sceneError } = await supabase
          .from('scenes')
          .select('*')
          .eq('id', sceneId)
          .single();

        if (sceneError) {
          console.error('Error fetching scene:', sceneError);
        } else {
          setScene(sceneData);
        }

        // Verify project access
        if (sceneData) {
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('id, user_id')
            .eq('id', projectId)
            .eq('user_id', user.id)
            .single();

          if (projectError || !projectData) {
            setError('Project not found or you do not have access');
            setIsLoading(false);
            return;
          }
        }
      } catch (err: any) {
        console.error('Error fetching shot:', err);
        setError(err.message || 'Failed to load shot');
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId && sceneId && shotId && user?.id) {
      fetchShotAndScene();
    }
  }, [projectId, sceneId, shotId, user?.id]);

  const handlePromptChange = async (value: string) => {
    setPrompt(value);
    
    if (!shotId) return;
    
    setIsSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('shots')
        .update({ script: value })
        .eq('id', shotId);

      if (updateError) {
        console.error('Error updating prompt:', updateError);
      } else {
        // Update local shot state
        setShot(prev => prev ? { ...prev, script: value } : null);
      }
    } catch (err) {
      console.error('Error updating prompt:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <nav className="w-full bg-gray-800">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-700 transition-colors mr-3"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-white">Loading...</h1>
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-black">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <p className="text-gray-400">Loading shot...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error || !shot) {
    return (
      <>
        <nav className="w-full bg-gray-800">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-700 transition-colors mr-3"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-white">Error</h1>
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-black">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error || 'Shot not found'}</p>
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Back to Project
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const shotNumber = shot.order_index + 1;

  return (
    <>
      {/* Navigation Bar */}
      <nav className="w-full bg-gray-800">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-700 transition-colors mr-3"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-white">
              {scene?.name || 'Scene'} - SHOT {shotNumber}
            </h1>
          </div>
        </div>
      </nav>

      <main className="h-[calc(100vh-4rem)] bg-black flex gap-2 p-2">
        {/* Left Section - Main Content */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Image Viewer Section */}
          <div className="flex-1 bg-gray-800 flex items-center justify-center">
            {shot.image_url ? (
              <img 
                src={shot.image_url} 
                alt={`Shot ${shotNumber}`}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <p className="text-white text-lg">IMAGE VIEWER</p>
              </div>
            )}
          </div>
          
          {/* Prompt Section (300px height) */}
          <div className="h-[300px] bg-gray-800 flex flex-col">
            <div className="w-full h-full p-4 flex flex-col relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-lg">PROMPT</p>
                {isSaving && (
                  <span className="text-gray-400 text-xs">Saving...</span>
                )}
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                className="flex-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 resize-none pr-12"
              />
              {/* Submit Button - Bottom Right */}
              <button
                onClick={() => handlePromptChange(prompt)}
                className="absolute bottom-6 right-6 w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                title="Submit prompt"
              >
                <svg 
                  className="w-5 h-5 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 5l7 7-7 7" 
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Sidebar - Images (300px width) */}
        <div className="w-[300px] bg-gray-800 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white text-lg">IMAGES</p>
          </div>
        </div>
      </main>
    </>
  );
}

