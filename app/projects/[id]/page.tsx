'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import Shot from '@/components/Shot';

interface Project {
  id: string;
  name: string;
  aspect_ratio: '16:9' | '1:1' | '9:16';
  art_style: string;
  created_at: string;
  updated_at: string;
}

interface Scene {
  id: string;
  project_id: string;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface ShotData {
  id: string;
  scene_id: string;
  order_index: number;
  image_url: string | null;
  script: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [shotsByScene, setShotsByScene] = useState<Record<string, ShotData[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjectAndScenes = async () => {
      if (!user?.id) {
        setIsLoading(false);
        setError('User not authenticated');
        return;
      }

      try {
        setIsLoading(true);
        
        // Fetch project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user.id)
          .single();

        if (projectError) {
          throw projectError;
        }

        if (!projectData) {
          setError('Project not found or you do not have access');
          setIsLoading(false);
          return;
        }

        setProject(projectData);

        // Fetch scenes
        const { data: scenesData, error: scenesError } = await supabase
          .from('scenes')
          .select('*')
          .eq('project_id', projectId)
          .order('order_index', { ascending: true });

        if (scenesError) {
          console.error('Error fetching scenes:', scenesError);
          setScenes([]);
        } else {
          // Set scenes (empty array if no scenes exist)
          setScenes(scenesData || []);
          
          // Fetch shots for all scenes if any exist
          if (scenesData && scenesData.length > 0) {
            await fetchShotsForScenes(scenesData.map(s => s.id));
          }
        }
      } catch (err: any) {
        console.error('Error fetching project:', err);
        setError(err.message || 'Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId && user?.id) {
      fetchProjectAndScenes();
    }
  }, [projectId, user?.id]);

  const fetchShotsForScenes = async (sceneIds: string[]) => {
    if (sceneIds.length === 0) return;

    try {
      const { data: shotsData, error: shotsError } = await supabase
        .from('shots')
        .select('*')
        .in('scene_id', sceneIds)
        .order('order_index', { ascending: true });

      if (shotsError) {
        console.error('Error fetching shots:', shotsError);
        return;
      }

      // Group shots by scene_id
      const grouped: Record<string, ShotData[]> = {};
      shotsData?.forEach((shot: ShotData) => {
        if (!grouped[shot.scene_id]) {
          grouped[shot.scene_id] = [];
        }
        grouped[shot.scene_id].push(shot);
      });

      // Initialize empty arrays for scenes with no shots
      sceneIds.forEach(sceneId => {
        if (!grouped[sceneId]) {
          grouped[sceneId] = [];
        }
      });

      setShotsByScene(prev => ({ ...prev, ...grouped }));
    } catch (err) {
      console.error('Error fetching shots:', err);
    }
  };

  const handleAddScene = async () => {
    if (!projectId || !user?.id) return;

    try {
      // Fetch current scenes from database to get accurate count
      const { data: currentScenes, error: fetchError } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (fetchError) {
        console.error('Error fetching scenes:', fetchError);
        alert('Failed to fetch scenes');
        return;
      }

      // Calculate next scene number based on existing scenes
      let nextSceneNumber = 1;
      if (currentScenes && currentScenes.length > 0) {
        // Extract scene numbers from existing scene names
        const sceneNumbers = currentScenes
          .map(scene => {
            const match = scene.name.match(/SCENE\s+(\d+)/i);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(num => num > 0);
        
        // Get the maximum scene number and add 1
        nextSceneNumber = sceneNumbers.length > 0 
          ? Math.max(...sceneNumbers) + 1 
          : currentScenes.length + 1;
      }

      // Get the next order index
      const nextOrderIndex = currentScenes ? currentScenes.length : 0;

      // Generate scene name
      const sceneName = `SCENE ${nextSceneNumber}`;

      const { data: newScene, error: createError } = await supabase
        .from('scenes')
        .insert([
          {
            project_id: projectId,
            name: sceneName,
            order_index: nextOrderIndex,
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error('Error creating scene:', createError);
        alert('Failed to create scene');
      } else {
        // Create default SHOT 1 for the new scene
        const { data: newShot, error: shotError } = await supabase
          .from('shots')
          .insert([
            {
              scene_id: newScene.id,
              order_index: 0,
            },
          ])
          .select()
          .single();

        if (shotError) {
          console.error('Error creating default shot:', shotError);
          // Don't fail scene creation if shot creation fails
        }

        // Update local state with the new scene
        setScenes(prev => [...prev, newScene]);
        
        // Update shots state with the new shot if created
        if (newShot) {
          setShotsByScene(prev => ({
            ...prev,
            [newScene.id]: [newShot],
          }));
        } else {
          // Fetch shots for the new scene
          await fetchShotsForScenes([newScene.id]);
        }
      }
    } catch (err: any) {
      console.error('Error creating scene:', err);
      alert('Failed to create scene');
    }
  };

  const handleAddShot = async (sceneId: string) => {
    if (!projectId || !user?.id) return;

    try {
      // Get current shots for this scene
      const currentShots = shotsByScene[sceneId] || [];
      const nextOrderIndex = currentShots.length;

      const { data: newShot, error: createError } = await supabase
        .from('shots')
        .insert([
          {
            scene_id: sceneId,
            order_index: nextOrderIndex,
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error('Error creating shot:', createError);
        console.error('Error details:', {
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          code: createError.code,
        });
        alert(`Failed to create shot: ${createError.message || 'Unknown error'}`);
      } else if (newShot) {
        // Update shots for this scene
        setShotsByScene(prev => ({
          ...prev,
          [sceneId]: [...(prev[sceneId] || []), newShot],
        }));
      }
    } catch (err: any) {
      console.error('Error creating shot:', err);
      alert(`Failed to create shot: ${err.message || 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <>
        {/* Custom Navigation Bar for loading state */}
        <nav className="w-full bg-gray-800">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={() => router.push('/projects')}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-700 transition-colors mr-3"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-white">
                Loading...
              </h1>
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-black">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <p className="text-gray-400">Loading project...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        {/* Custom Navigation Bar for error state */}
        <nav className="w-full bg-gray-800">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={() => router.push('/projects')}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-700 transition-colors mr-3"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-white">
                Error
              </h1>
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-black">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">
                {error || 'Project not found'}
              </p>
              <button
                onClick={() => router.push('/projects')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Back to Projects
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {/* Custom Navigation Bar */}
      <nav className="w-full bg-gray-800">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => router.push('/projects')}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-700 transition-colors mr-3"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-white">
              {project.name}
            </h1>
          </div>
        </div>
      </nav>

      <main className="min-h-screen bg-black">
        <div className="w-full">
          {/* Scenes List */}
          <div className="px-4 py-4">
            {scenes.map((scene, index) => (
              <div key={scene.id} className={index > 0 ? "mt-4" : ""}>
                {/* Scene Container */}
                <div className="bg-gray-800">
                  {/* Scene Header */}
                  <div className="bg-gray-700 px-4 py-3">
                    <h2 className="text-white font-bold text-base uppercase tracking-wide">{scene.name}</h2>
                  </div>
                  
                  {/* Scene Content Area */}
                  <div className="bg-gray-800 px-4 py-6 min-h-[320px]">
                    {/* Shots Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {shotsByScene[scene.id] && shotsByScene[scene.id].length > 0 && 
                        shotsByScene[scene.id].map((shot, index) => (
                          <Shot
                            key={shot.id}
                            id={shot.id}
                            shotNumber={index + 1}
                            imageUrl={shot.image_url || undefined}
                            script={shot.script || undefined}
                            onClick={() => {
                              router.push(`/projects/${projectId}/scenes/${scene.id}/shots/${shot.id}`);
                            }}
                          />
                        ))
                      }
                      
                      {/* Add Shot Button - Inside Grid */}
                      <div
                        className="flex items-center justify-center bg-gray-800 border-2 border-white rounded cursor-pointer hover:bg-gray-700 transition-colors h-[250px]"
                        onClick={() => handleAddShot(scene.id)}
                      >
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Separator line after each scene */}
                <div className="h-px bg-gray-700 mt-4"></div>
              </div>
            ))}
            
            {/* Add Scene Button - Below last separator */}
            <div className="flex justify-center mt-4 pb-8">
              <button
                onClick={handleAddScene}
                className="w-12 h-12 bg-transparent border-2 border-red-500 rounded flex items-center justify-center hover:bg-gray-900 transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

