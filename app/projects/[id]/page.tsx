'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

interface Character {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  clothes: string | null;
  image_url: string | null;
  reference_images: string[] | null;
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
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [scenarioText, setScenarioText] = useState('');
  const [isProcessingScenario, setIsProcessingScenario] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [generatingShotIds, setGeneratingShotIds] = useState<Set<string>>(new Set());
  const [generateImages, setGenerateImages] = useState(true);
  const [showCastModal, setShowCastModal] = useState(false);
  const [castCharacters, setCastCharacters] = useState<any[]>([]);
  const [castScenarioAnalysis, setCastScenarioAnalysis] = useState<any>(null);
  const [isProcessingCast, setIsProcessingCast] = useState(false);
  const [castProcessingStatus, setCastProcessingStatus] = useState<string>('');
  const [castGenerateImages, setCastGenerateImages] = useState(true);
  const [isCastEditMode, setIsCastEditMode] = useState(false);
  const [castEditingIndex, setCastEditingIndex] = useState<number | null>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [characterName, setCharacterName] = useState('');
  const [characterDescription, setCharacterDescription] = useState('');
  const [characterClothes, setCharacterClothes] = useState('');
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showCharacterMenu, setShowCharacterMenu] = useState(false);
  const characterMenuRef = useRef<HTMLDivElement>(null);
  const characterButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showThumbnailMenu, setShowThumbnailMenu] = useState(false);
  const thumbnailMenuRef = useRef<HTMLDivElement>(null);
  const thumbnailButtonRef = useRef<HTMLDivElement>(null);
  const [thumbnailMenuPosition, setThumbnailMenuPosition] = useState({ top: 0, left: 0 });
  const [isGeneratingCharacterImage, setIsGeneratingCharacterImage] = useState(false);
  const castGenerationInProgressRef = useRef(false);
  const castGenerateImagesRef = useRef(castGenerateImages);
  const [castGeneratingIndices, setCastGeneratingIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    castGenerateImagesRef.current = castGenerateImages;
  }, [castGenerateImages]);

  const autoGenerateCastImages = useCallback(async (analysis: any) => {
    if (!castGenerateImagesRef.current) return;
    if (!analysis || !analysis.analysis?.characters?.length) return;
    if (castGenerationInProgressRef.current) return;

    const characters: any[] = analysis.analysis.characters;
    const pending = characters
      .map((char, index) => ({ char, index }))
      .filter(({ char }) => !char?.image_url && (char?.description || char?.clothes));

    if (pending.length === 0) return;

    castGenerationInProgressRef.current = true;

    try {
      const tasks = pending.map(({ char, index }) => async () => {
        if (!castGenerateImagesRef.current) return;

        const promptParts: string[] = [];
        if (char.description) {
          promptParts.push(char.description.trim());
        }
        if (char.clothes) {
          promptParts.push(`wearing ${char.clothes.trim()}`);
        }

        const finalPrompt = promptParts.join(', ');
        if (!finalPrompt) return;

        setCastGeneratingIndices(prev => {
          const next = new Set(prev);
          next.add(index);
          return next;
        });

        try {
          const generateResponse = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: finalPrompt,
              aspect_ratio: '1:1',
            }),
          });

          if (!generateResponse.ok) {
            const errorData = await generateResponse.json().catch(() => null);
            throw new Error(errorData?.error || 'Failed to generate character image');
          }

          const { imageBase64 } = await generateResponse.json();

          const uploadResponse = await fetch('/api/upload-character-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageBase64,
              projectId,
            }),
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => null);
            throw new Error(errorData?.error || 'Failed to upload character image');
          }

          const { imageUrl } = await uploadResponse.json();

          characters[index] = {
            ...characters[index],
            image_url: imageUrl,
          };

          setCastCharacters(prev => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = { ...updated[index], image_url: imageUrl };
            }
            return updated;
          });

          setCastScenarioAnalysis(prev => {
            if (!prev) return prev;
            const updatedCharacters = [...(prev.analysis.characters || [])];
            if (updatedCharacters[index]) {
              updatedCharacters[index] = { ...updatedCharacters[index], image_url: imageUrl };
            }
            const updatedAnalysis = {
              ...prev,
              analysis: {
                ...prev.analysis,
                characters: updatedCharacters,
              },
            };
            sessionStorage.setItem(`scenario_analysis_${projectId}`, JSON.stringify(updatedAnalysis));
            return updatedAnalysis;
          });
        } catch (error) {
          console.error('Error auto-generating cast image:', error);
        } finally {
          setCastGeneratingIndices(prev => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }
      });

      await Promise.allSettled(tasks.map(task => task()));
    } finally {
      castGenerationInProgressRef.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    if (!castScenarioAnalysis) return;
    if (!castGenerateImages) return;
    const hasPending = castScenarioAnalysis.analysis?.characters?.some((char: any) => !char?.image_url && (char?.description || char?.clothes));
    if (!hasPending) return;
    autoGenerateCastImages(castScenarioAnalysis);
  }, [castScenarioAnalysis, autoGenerateCastImages, castGenerateImages]);

  // Handle ESC key to close modals and menus
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showScenarioModal) {
          setShowScenarioModal(false);
        } else if (showCastModal) {
          setShowCastModal(false);
        } else if (showCharacterModal) {
          setShowCharacterModal(false);
          setEditingCharacter(null);
          setCharacterName('');
          setCharacterDescription('');
          setCharacterClothes('');
          setCharacterImage(null);
          setReferenceImages([]);
          setIsCastEditMode(false);
          setCastEditingIndex(null);
        } else if (showCharacterMenu) {
          setShowCharacterMenu(false);
        } else if (showThumbnailMenu) {
          setShowThumbnailMenu(false);
        }
      }
    };

    if (showScenarioModal || showCastModal || showCharacterModal || showCharacterMenu || showThumbnailMenu) {
      document.addEventListener('keydown', handleEscape);
      if (showScenarioModal || showCastModal || showCharacterModal) {
        document.body.style.overflow = 'hidden';
      }
      return () => {
        document.removeEventListener('keydown', handleEscape);
        if (showScenarioModal || showCastModal || showCharacterModal) {
          document.body.style.overflow = 'unset';
        }
      };
    }
  }, [showScenarioModal, showCastModal, showCharacterModal, showCharacterMenu, showThumbnailMenu]);

  // Handle click outside character menu and calculate position
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (characterMenuRef.current && !characterMenuRef.current.contains(event.target as Node) &&
          characterButtonRef.current && !characterButtonRef.current.contains(event.target as Node)) {
        setShowCharacterMenu(false);
      }
    };

    const updateMenuPosition = () => {
      if (characterButtonRef.current && showCharacterMenu) {
        const rect = characterButtonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + window.scrollY + 4,
          right: window.innerWidth - rect.right - window.scrollX,
        });
      }
    };

    if (showCharacterMenu) {
      updateMenuPosition();
      window.addEventListener('resize', updateMenuPosition);
      window.addEventListener('scroll', updateMenuPosition, true);
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        window.removeEventListener('resize', updateMenuPosition);
        window.removeEventListener('scroll', updateMenuPosition, true);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCharacterMenu]);

  // Handle click outside thumbnail menu and calculate position
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (thumbnailMenuRef.current && !thumbnailMenuRef.current.contains(event.target as Node) &&
          thumbnailButtonRef.current && !thumbnailButtonRef.current.contains(event.target as Node)) {
        setShowThumbnailMenu(false);
      }
    };

    const updateThumbnailMenuPosition = () => {
      if (thumbnailButtonRef.current && showThumbnailMenu) {
        const rect = thumbnailButtonRef.current.getBoundingClientRect();
        setThumbnailMenuPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
    };

    if (showThumbnailMenu) {
      updateThumbnailMenuPosition();
      window.addEventListener('resize', updateThumbnailMenuPosition);
      window.addEventListener('scroll', updateThumbnailMenuPosition, true);
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        window.removeEventListener('resize', updateThumbnailMenuPosition);
        window.removeEventListener('scroll', updateThumbnailMenuPosition, true);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showThumbnailMenu]);

  // Close thumbnail menu when character modal closes
  useEffect(() => {
    if (!showCharacterModal) {
      setShowThumbnailMenu(false);
    }
  }, [showCharacterModal]);

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

        // Fetch characters for this project
        await fetchCharacters();
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

  const fetchCharacters = async () => {
    if (!projectId) return;

    try {
      // Fetch characters directly by project_id
      const { data: charactersData, error: charactersError } = await supabase
        .from('characters')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (charactersError) {
        console.error('Error fetching characters:', charactersError);
        return;
      }

      setCharacters(charactersData || []);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  };

  const handleImageUpload = async (files: File[]) => {
    if (!projectId) {
      alert('Project ID is missing');
      return;
    }

    try {
      // Read files as base64
      const imagePromises = files.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve(e.target?.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(imagePromises);

      // Upload each image to R2
      const uploadPromises = base64Images.map(async (base64Image) => {
        try {
          const response = await fetch('/api/upload-reference-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageBase64: base64Image,
              projectId: projectId,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to upload image');
          }

          const { imageUrl } = await response.json();
          return imageUrl;
        } catch (error) {
          console.error('Error uploading image:', error);
          throw error;
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setReferenceImages(prev => [...prev, ...uploadedUrls]);
    } catch (error: any) {
      console.error('Error handling image upload:', error);
      alert(`Failed to upload images: ${error.message}`);
    }
  };

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

  const handleDeleteScene = async (sceneId: string) => {
    if (!projectId || !user?.id) return;

    // Confirm deletion
    if (!confirm('Are you sure you want to delete this scene? All shots in this scene will also be deleted.')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('scenes')
        .delete()
        .eq('id', sceneId);

      if (deleteError) {
        console.error('Error deleting scene:', deleteError);
        alert(`Failed to delete scene: ${deleteError.message || 'Unknown error'}`);
        return;
      }

      // Update local state
      setScenes(prev => prev.filter(scene => scene.id !== sceneId));
      setShotsByScene(prev => {
        const updated = { ...prev };
        delete updated[sceneId];
        return updated;
      });
    } catch (err: any) {
      console.error('Error deleting scene:', err);
      alert(`Failed to delete scene: ${err.message || 'Unknown error'}`);
    }
  };

  const handleCastCharacterClick = (index: number) => {
    if (castGeneratingIndices.has(index)) {
      return;
    }
    const character = castCharacters[index];
    if (!character) return;

    setIsCastEditMode(true);
    setCastEditingIndex(index);
    setEditingCharacter(null);
    setCharacterName(character.name || '');
    setCharacterDescription(character.description || '');
    setCharacterClothes(character.clothes || '');
    setCharacterImage(character.image_url || null);
    setReferenceImages(character.reference_images || []);
    setShowCharacterModal(true);
  };

  const handleEditCharacter = (index: number) => {
    setEditingCharacterIndex(index);
    const char = characters[index];
    setEditingCharacter({ ...char });
    setEditingDescription(char.description || '');
    setEditingClothes(char.clothes || '');
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
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
            <button
              onClick={() => setShowScenarioModal(true)}
              className={`flex items-center justify-center w-10 h-10 rounded-lg relative overflow-hidden hover:opacity-90 transition-opacity ${
                scenes.length === 0 ? 'rainbow-glow' : 'hover:bg-gray-700'
              }`}
              title="Paste scenario"
            >
              <div className={`absolute inset-[1px] rounded-lg ${
                scenes.length === 0 ? 'bg-gray-800/80' : 'bg-gray-800'
              }`}></div>
              <svg
                className={`w-6 h-6 text-white relative z-10 ${
                  scenes.length === 0 ? 'drop-shadow-lg' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Cast Navigation Bar */}
      <nav className="w-full bg-gray-700 border-b border-gray-600 relative z-10">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-3 min-w-max py-2">
              <span className="text-white text-sm font-semibold mr-2 whitespace-nowrap">CAST</span>
              {/* Cast items will be added here */}
              <div className="flex items-center gap-2">
                {/* Character badges */}
                {characters.map((character) => (
                  <div
                    key={character.id}
                    onClick={() => {
                      setEditingCharacter(character);
                      setCharacterName(character.name);
                      setCharacterDescription(character.description || '');
                      setCharacterClothes(character.clothes || '');
                      setCharacterImage(character.image_url);
                      setReferenceImages(character.reference_images || []);
                      setIsCastEditMode(false);
                      setCastEditingIndex(null);
                      setShowCharacterModal(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors cursor-pointer group"
                    title={character.description || character.name}
                  >
                    {character.image_url ? (
                      <img
                        src={character.image_url}
                        alt={character.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    )}
                    <span className="text-white text-xs font-medium whitespace-nowrap">
                      {character.name}
                    </span>
                  </div>
                ))}
              </div>
              {/* Add Character Button with Popup Menu */}
              <div className="relative ml-2">
                <button
                  ref={characterButtonRef}
                  onClick={() => setShowCharacterMenu(!showCharacterMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
                  title="Add character"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add character</span>
                </button>
              </div>
              
              {/* Popup Menu - Fixed positioning to avoid overflow issues */}
              {showCharacterMenu && (
                <div
                  ref={characterMenuRef}
                  className="fixed w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[9999]"
                  style={{
                    top: `${menuPosition.top}px`,
                    right: `${menuPosition.right}px`,
                  }}
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowCharacterMenu(false);
                        // TODO: Open character library modal
                        console.log('From library clicked');
                      }}
                      className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 transition-colors text-sm"
                    >
                      From library
                    </button>
                      <button
                        onClick={() => {
                          setShowCharacterMenu(false);
                          setEditingCharacter(null);
                          setCharacterName('');
                          setCharacterDescription('');
                          setCharacterClothes('');
                          setCharacterImage(null);
          setReferenceImages([]);
                          setShowCharacterModal(true);
                        }}
                        className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 transition-colors text-sm"
                      >
                        Create character
                      </button>
                  </div>
                </div>
              )}
            </div>
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
                  <div className="bg-gray-700 px-4 py-3 group/header relative flex items-center justify-between">
                    <h2 className="text-white font-bold text-base uppercase tracking-wide">{scene.name}</h2>
                    {/* Delete button - visible on hover */}
                    <button
                      onClick={() => handleDeleteScene(scene.id)}
                      className="opacity-0 group-hover/header:opacity-100 transition-opacity p-1.5 hover:bg-red-600 rounded text-white"
                      title="Delete scene"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
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
                            imageUrl={shot.thumbnail || shot.image_url || undefined}
                            script={shot.script || undefined}
                            isGenerating={generatingShotIds.has(shot.id)}
                            onClick={() => {
                              router.push(`/projects/${projectId}/scenes/${scene.id}/shots/${shot.id}`);
                            }}
                          />
                        ))
                      }
                      
                      {/* Add Shot Button - Inside Grid */}
                      <div
                        className="flex flex-col items-center justify-center bg-gray-800 border-2 border-white/50 rounded cursor-pointer hover:bg-gray-700 transition-colors h-[250px] gap-2"
                        onClick={() => handleAddShot(scene.id)}
                      >
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <p className="text-white text-sm">Add a shot</p>
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
                className="flex flex-col items-center justify-center bg-transparent hover:bg-gray-900 transition-colors gap-2 px-4 py-2"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-white text-sm">Add a scene</p>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Scenario Paste Modal */}
      {showScenarioModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowScenarioModal(false);
            }
          }}
        >
          <div
            className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Paste Scenario</h2>
              <button
                onClick={() => {
                  setShowScenarioModal(false);
                }}
                className="text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-4 overflow-y-auto">
              <textarea
                value={scenarioText}
                onChange={(e) => setScenarioText(e.target.value)}
                placeholder="Paste your scenario here..."
                className="w-full h-full min-h-[400px] bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-gray-600"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-700">
              {/* Processing Status */}
              {isProcessingScenario && processingStatus && (
                <div className="mb-3 p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-white text-sm">{processingStatus}</span>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setScenarioText('');
                    setShowScenarioModal(false);
                    setProcessingStatus('');
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  disabled={isProcessingScenario}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!scenarioText.trim()) {
                      alert('Please enter a scenario');
                      return;
                    }

                    setIsProcessingScenario(true);
                    setProcessingStatus('시나리오 분석 중...');

                    try {
                      // Call API to analyze scenario
                      const response = await fetch('/api/process-scenario', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ scenario: scenarioText }),
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to analyze scenario');
                      }

                      const { analysis } = await response.json();

                      if (!analysis || !analysis.scenes || analysis.scenes.length === 0) {
                        alert('No scenes found in the scenario');
                        setIsProcessingScenario(false);
                        setProcessingStatus('');
                        return;
                      }

                      // Store analysis result in sessionStorage
                      const scenarioAnalysis = {
                        scenario: scenarioText,
                        analysis: analysis,
                      };
                      sessionStorage.setItem(`scenario_analysis_${projectId}`, JSON.stringify(scenarioAnalysis));

                      // Load characters and open CAST modal
                      setCastCharacters(analysis.characters || []);
                      setCastScenarioAnalysis(scenarioAnalysis);
                      setCastGenerateImages(true);
                      setCastGeneratingIndices(() => new Set());

                      // Close scenario modal and open CAST modal
                      setScenarioText('');
                      setProcessingStatus('');
                      setShowScenarioModal(false);
                      setShowCastModal(true);
                    } catch (error: any) {
                      console.error('Error analyzing scenario:', error);
                      setProcessingStatus('');
                      alert(`Failed to analyze scenario: ${error.message}`);
                    } finally {
                      setIsProcessingScenario(false);
                      setProcessingStatus('');
                    }
                  }}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2 border border-pink-500"
                  disabled={!scenarioText.trim() || isProcessingScenario}
                >
                  {isProcessingScenario ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-gray-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      분석 중...
                    </>
                  ) : (
                    <>
                      Next
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* CAST Modal */}
      {showCastModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-40 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCastModal(false);
              setIsCastEditMode(false);
              setCastEditingIndex(null);
            }
          }}
        >
          <div
            className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Cast</h2>
              <button
                onClick={() => {
                  setShowCastModal(false);
                  setIsCastEditMode(false);
                  setCastEditingIndex(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Characters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {castCharacters.map((character, index) => (
                  <div
                    key={index}
                    onClick={() => handleCastCharacterClick(index)}
                    className="relative bg-gray-700 rounded-lg overflow-hidden cursor-pointer border border-transparent hover:border-pink-500/60 transition-colors"
                  >
                    {/* Character Image */}
                    <div className="relative w-full aspect-[3/4] bg-gray-900 flex items-center justify-center">
                      {character.image_url ? (
                        <img
                          src={character.image_url}
                          alt={character.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg
                            className="w-16 h-16 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                          </svg>
                        </div>
                      )}
                      {castGeneratingIndices.has(index) && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <svg className="h-10 w-10 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Character Info */}
                    <div className="p-4">
                      <h3 className="text-white font-semibold text-base mb-2">{character.name}</h3>
                      <div className="text-gray-300 text-sm">
                        <p className="mb-1">
                          {character.description || 'No description'}
                        </p>
                        {character.clothes && (
                          <p className="text-gray-400 text-xs">
                            {character.clothes}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-pink-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m6 0l-3 3m3-3l-3-3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Click to edit</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Generate Images Checkbox */}
              <div className="mb-6 flex items-center">
                <input
                  type="checkbox"
                  id="castGenerateImages"
                  checked={castGenerateImages}
                  onChange={(e) => setCastGenerateImages(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
                <label
                  htmlFor="castGenerateImages"
                  className="ml-2 text-white text-sm cursor-pointer select-none"
                >
                  Generate Images
                </label>
              </div>

              {/* Processing Status */}
              {isProcessingCast && castProcessingStatus && (
                <div className="mb-6 p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-white text-sm">{castProcessingStatus}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCastModal(false);
                    setIsCastEditMode(false);
                    setCastEditingIndex(null);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  disabled={isProcessingCast}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!castScenarioAnalysis || !projectId || !user?.id) {
                      alert('Missing required information');
                      return;
                    }

                    setIsProcessingCast(true);
                    setCastProcessingStatus('시나리오 처리 중...');

                    try {
                      const { analysis } = castScenarioAnalysis;

                      if (!analysis || !analysis.scenes || analysis.scenes.length === 0) {
                        alert('No scenes found in the scenario');
                        setIsProcessingCast(false);
                        setCastProcessingStatus('');
                        return;
                      }

                      // Get current scene count for order_index
                      setCastProcessingStatus('기존 Scene 확인 중...');
                      const { data: currentScenes } = await supabase
                        .from('scenes')
                        .select('id')
                        .eq('project_id', projectId);
                      
                      let currentOrderIndex = currentScenes?.length || 0;
                      const totalScenes = analysis.scenes.length;
                      let totalShots = 0;
                      analysis.scenes.forEach((scene: any) => {
                        totalShots += scene.shots.length;
                      });
                      let currentShotIndex = 0;
                      const createdShotIds: string[] = [];

                      // Helper function to clean script for image generation prompt using Gemini API
                      const cleanPromptForImageGeneration = async (script: string): Promise<string> => {
                        if (!script || !script.trim()) return '';
                        
                        try {
                          const response = await fetch('/api/clean-prompt', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ script }),
                          });

                          if (!response.ok) {
                            const errorData = await response.json();
                            console.error('Error cleaning prompt:', errorData.error);
                            return script.trim();
                          }

                          const { cleanedPrompt } = await response.json();
                          return cleanedPrompt || script.trim();
                        } catch (error) {
                          console.error('Error calling clean-prompt API:', error);
                          return script.trim();
                        }
                      };

                      // Create scenes and shots
                      for (let sceneIndex = 0; sceneIndex < analysis.scenes.length; sceneIndex++) {
                        const sceneData = analysis.scenes[sceneIndex];
                        
                        // Create scene
                        setCastProcessingStatus(`Scene 생성 중... (${sceneIndex + 1}/${totalScenes}) - ${sceneData.name}`);
                        const { data: newScene, error: sceneError } = await supabase
                          .from('scenes')
                          .insert([
                            {
                              project_id: projectId,
                              name: sceneData.name,
                              order_index: currentOrderIndex++,
                            },
                          ])
                          .select()
                          .single();

                        if (sceneError) {
                          console.error('Error creating scene:', sceneError);
                          continue;
                        }

                        if (!newScene) continue;
                        
                        // Clean all prompts for this scene in parallel
                        setCastProcessingStatus(`프롬프트 정리 중... (Scene ${sceneIndex + 1}/${totalScenes})`);
                        const cleanedPrompts = await Promise.all(
                          sceneData.shots.map(shotData => cleanPromptForImageGeneration(shotData.script))
                        );
                        
                        // Create shots for this scene
                        for (let i = 0; i < sceneData.shots.length; i++) {
                          const shotData = sceneData.shots[i];
                          currentShotIndex++;
                          
                          setCastProcessingStatus(`Shot 생성 중... (${currentShotIndex}/${totalShots})`);
                          const cleanedPrompt = cleanedPrompts[i];
                          
                          // Create default GenerateImage node with cleaned script as input
                          const defaultNode = {
                            id: `generateImage-${Date.now()}-${sceneIndex}-${i}`,
                            type: 'generateImage',
                            position: { x: 250, y: 250 },
                            data: {
                              input: cleanedPrompt,
                            },
                          };
                          
                          const defaultNodeGraph = {
                            nodes: [defaultNode],
                            edges: [],
                          };
                          
                          const { data: newShot, error: shotError } = await supabase
                            .from('shots')
                            .insert([
                              {
                                scene_id: newScene.id,
                                order_index: i,
                                script: shotData.script,
                                node_graph: defaultNodeGraph,
                              },
                            ])
                            .select()
                            .single();

                          if (shotError) {
                            console.error('Error creating shot:', shotError);
                          } else if (newShot) {
                            createdShotIds.push(newShot.id);
                          }
                        }
                      }
                      
                      // Create characters if they exist in the analysis
                      if (castCharacters && Array.isArray(castCharacters) && castCharacters.length > 0) {
                        setCastProcessingStatus(`캐릭터 생성 중... (0/${castCharacters.length})`);
                        
                        // Check existing characters to avoid duplicates
                        const { data: existingCharacters } = await supabase
                          .from('characters')
                          .select('name')
                          .eq('project_id', projectId);
                        
                        const existingCharacterNames = new Set(
                          (existingCharacters || []).map((c: any) => c.name.toLowerCase().trim())
                        );
                        
                        // Filter out characters that already exist
                        const charactersToCreate = castCharacters.filter((char: any) => 
                          char.name && !existingCharacterNames.has(char.name.toLowerCase().trim())
                        );
                        
                        if (charactersToCreate.length > 0) {
                          // Create all characters
                          for (let i = 0; i < charactersToCreate.length; i++) {
                            const charData = charactersToCreate[i];
                            setCastProcessingStatus(`캐릭터 생성 중... (${i + 1}/${charactersToCreate.length}) - ${charData.name}`);
                            
                            const { error: characterError } = await supabase
                              .from('characters')
                              .insert({
                                project_id: projectId,
                                name: charData.name.trim(),
                                description: charData.description?.trim() || null,
                                clothes: charData.clothes?.trim() || null,
                                image_url: charData.image_url || null,
                                reference_images: charData.reference_images || null,
                              });
                            
                            if (characterError) {
                              console.error(`Error creating character ${charData.name}:`, characterError);
                            }
                          }
                          
                          // Refresh characters list
                          await fetchCharacters();
                        }
                      }
                      
                      setCastProcessingStatus('완료 중...');

                      // Fetch project to get aspect_ratio
                      const { data: projectData } = await supabase
                        .from('projects')
                        .select('aspect_ratio')
                        .eq('id', projectId)
                        .single();

                      // Auto-generate images for all created shots (parallel processing)
                      if (castGenerateImages && createdShotIds.length > 0 && projectData?.aspect_ratio) {
                        setCastProcessingStatus(`이미지 생성 중... (0/${createdShotIds.length})`);
                        
                        // Mark all shots as generating
                        setGeneratingShotIds(prev => {
                          const next = new Set(prev);
                          createdShotIds.forEach(id => next.add(id));
                          return next;
                        });
                        
                        // Process all shots in parallel
                        const imageGenerationPromises = createdShotIds.map(async (shotId) => {
                          try {
                            // Fetch shot with node_graph
                            const { data: shotData, error: shotFetchError } = await supabase
                              .from('shots')
                              .select('id, node_graph')
                              .eq('id', shotId)
                              .single();

                            if (shotFetchError || !shotData || !shotData.node_graph) {
                              console.error('Error fetching shot for image generation:', shotFetchError);
                              return;
                            }

                            // Find Generate Image node
                            const generateImageNode = shotData.node_graph.nodes?.find(
                              (node: any) => node.type === 'generateImage'
                            );

                            if (!generateImageNode || !generateImageNode.data?.input?.trim()) {
                              console.log(`Skipping shot ${shotId}: No valid Generate Image node or input`);
                              return;
                            }

                            const prompt = generateImageNode.data.input.trim();

                            // Step 1: Generate image using BFL API
                            const generateResponse = await fetch('/api/generate-image', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                prompt,
                                aspect_ratio: projectData.aspect_ratio,
                              }),
                            });

                            if (!generateResponse.ok) {
                              const errorData = await generateResponse.json();
                              console.error(`Error generating image for shot ${shotId}:`, errorData.error);
                              return;
                            }

                            const { imageBase64 } = await generateResponse.json();

                            // Step 2: Upload to R2
                            const uploadResponse = await fetch('/api/upload-to-r2', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({ imageBase64, shotId }),
                            });

                            if (!uploadResponse.ok) {
                              const errorData = await uploadResponse.json();
                              console.error(`Error uploading image for shot ${shotId}:`, errorData.error);
                              return;
                            }

                            const { imageUrl } = await uploadResponse.json();

                            // Step 3: Save image URL to database
                            const { data: newImage, error: insertError } = await supabase
                              .from('shot_images')
                              .insert({
                                shot_id: shotId,
                                image_url: imageUrl,
                                prompt: prompt,
                                is_primary: false,
                              })
                              .select()
                              .single();

                            if (insertError) {
                              console.error(`Error saving image for shot ${shotId}:`, insertError);
                              return;
                            }

                            // Step 4: Check if this is the first image for this shot and set as primary
                            const { data: existingImages } = await supabase
                              .from('shot_images')
                              .select('id, is_primary')
                              .eq('shot_id', shotId)
                              .order('created_at', { ascending: true });
                            
                            if (existingImages && existingImages.length > 0) {
                              const firstImage = existingImages[0];
                              
                              if (firstImage.id === newImage.id) {
                                await supabase
                                  .from('shot_images')
                                  .update({ is_primary: true })
                                  .eq('id', newImage.id);
                                
                                await supabase
                                  .from('shots')
                                  .update({ thumbnail: imageUrl })
                                  .eq('id', shotId);
                              }
                            }

                            // Step 5: Update node_graph with output
                            const updatedNodes = shotData.node_graph.nodes.map((node: any) => {
                              if (node.id === generateImageNode.id) {
                                return {
                                  ...node,
                                  data: {
                                    ...node.data,
                                    output: imageUrl,
                                  },
                                };
                              }
                              return node;
                            });

                            const updatedNodeGraph = {
                              nodes: updatedNodes,
                              edges: shotData.node_graph.edges || [],
                            };

                            await supabase
                              .from('shots')
                              .update({ node_graph: updatedNodeGraph })
                              .eq('id', shotId);

                          } catch (error: any) {
                            console.error(`Error processing image generation for shot ${shotId}:`, error);
                          } finally {
                            // Mark shot as no longer generating
                            setGeneratingShotIds(prev => {
                              const next = new Set(prev);
                              next.delete(shotId);
                              return next;
                            });
                          }
                        });
                        
                        await Promise.all(imageGenerationPromises);
                        
                        // After all images are generated, update thumbnails for all shots
                        for (const shotId of createdShotIds) {
                          try {
                            const { data: primaryImage } = await supabase
                              .from('shot_images')
                              .select('id, image_url')
                              .eq('shot_id', shotId)
                              .order('created_at', { ascending: true })
                              .limit(1)
                              .single();

                            if (primaryImage) {
                              await supabase
                                .from('shot_images')
                                .update({ is_primary: true })
                                .eq('id', primaryImage.id);
                              
                              await supabase
                                .from('shots')
                                .update({ thumbnail: primaryImage.image_url })
                                .eq('id', shotId);
                            }
                          } catch (error) {
                            console.error(`Error updating thumbnail for shot ${shotId}:`, error);
                          }
                        }
                        
                        // Refresh shots to show updated thumbnails
                        const { data: scenesData } = await supabase
                          .from('scenes')
                          .select('*')
                          .eq('project_id', projectId)
                          .order('order_index', { ascending: true });
                        
                        if (scenesData) {
                          await fetchShotsForScenes(scenesData.map(s => s.id));
                        }
                      }

                      // Clear sessionStorage
                      sessionStorage.removeItem(`scenario_analysis_${projectId}`);

                      // Refresh scenes and shots
                      const { data: scenesData, error: scenesError } = await supabase
                        .from('scenes')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('order_index', { ascending: true });

                      if (!scenesError && scenesData) {
                        setScenes(scenesData);
                        await fetchShotsForScenes(scenesData.map(s => s.id));
                      }

                      // Close modal
                      setShowCastModal(false);
                      setCastProcessingStatus('');
                    } catch (error: any) {
                      console.error('Error processing scenario:', error);
                      setCastProcessingStatus('');
                      alert(`Failed to process scenario: ${error.message}`);
                    } finally {
                      setIsProcessingCast(false);
                      setCastProcessingStatus('');
                    }
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2 border border-pink-500"
                  disabled={isProcessingCast}
                >
                  {isProcessingCast ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      처리 중...
                    </>
                  ) : (
                    'Process'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Character Modal */}
      {showCharacterModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCharacterModal(false);
              setEditingCharacter(null);
              setCharacterName('');
              setCharacterDescription('');
              setCharacterClothes('');
              setCharacterImage(null);
          setReferenceImages([]);
              setIsCastEditMode(false);
              setCastEditingIndex(null);
            }
          }}
        >
          <div
            className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">
                {editingCharacter ? 'Edit character' : 'Create character'}
              </h2>
              <button
                onClick={() => {
                  setShowCharacterModal(false);
                  setEditingCharacter(null);
                  setCharacterName('');
                  setCharacterDescription('');
                  setCharacterClothes('');
                  setCharacterImage(null);
          setReferenceImages([]);
                  setIsCastEditMode(false);
                  setCastEditingIndex(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex gap-6">
                {/* Left Column - Appearance Section */}
                <div className="w-48 flex-shrink-0 flex flex-col items-center gap-4 pr-6 border-r border-gray-600 relative">
                  {/* Circular Character Image */}
                  <div 
                    ref={thumbnailButtonRef}
                    onClick={() => {
                      if (thumbnailButtonRef.current) {
                        const rect = thumbnailButtonRef.current.getBoundingClientRect();
                        setThumbnailMenuPosition({
                          top: rect.bottom + window.scrollY + 4,
                          left: rect.left + window.scrollX,
                        });
                      }
                      setShowThumbnailMenu(!showThumbnailMenu);
                    }}
                    className="relative w-40 h-40 rounded-full overflow-hidden bg-gray-900 border-0 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {characterImage ? (
                      <img
                        src={characterImage}
                        alt="Character"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <svg
                          className="w-16 h-16 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      </div>
                    )}
                    {isGeneratingCharacterImage && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <svg className="h-10 w-10 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Thumbnail Menu */}
                  {showThumbnailMenu && (
                    <div
                      ref={thumbnailMenuRef}
                      className="absolute z-[100] bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[180px]"
                      style={{
                        top: 0,
                        left: 'calc(100% + 8px)',
                      }}
                    >
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setShowThumbnailMenu(false);
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (!file || !projectId) return;
                              
                              try {
                                // Read file as base64
                                const base64Image = await new Promise<string>((resolve, reject) => {
                                  const reader = new FileReader();
                                  reader.onload = (e) => {
                                    resolve(e.target?.result as string);
                                  };
                                  reader.onerror = reject;
                                  reader.readAsDataURL(file);
                                });

                                // Upload to R2
                                const response = await fetch('/api/upload-character-image', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    imageBase64: base64Image,
                                    projectId: projectId,
                                  }),
                                });

                                if (!response.ok) {
                                  const errorData = await response.json();
                                  throw new Error(errorData.error || 'Failed to upload image');
                                }

                                const { imageUrl } = await response.json();
                                setCharacterImage(imageUrl);
                              } catch (error: any) {
                                console.error('Error uploading character image:', error);
                                alert(`Failed to upload image: ${error.message}`);
                              }
                            };
                            input.click();
                          }}
                          className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors text-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Upload Image
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setShowThumbnailMenu(false);
                            
                            const basePromptParts: string[] = [];
                            if (characterDescription.trim()) {
                              basePromptParts.push(characterDescription.trim());
                            }
                            if (characterClothes.trim()) {
                              basePromptParts.push(`wearing ${characterClothes.trim()}`);
                            }

                            const finalPrompt = basePromptParts.join(', ');

                            if (!finalPrompt) {
                              alert('Please provide a character description or clothes to generate an image.');
                              return;
                            }
                            
                            if (!project?.aspect_ratio) {
                              alert('Project aspect ratio not found');
                              return;
                            }
                            
                            setIsGeneratingCharacterImage(true);
                            try {
                              // Generate image using BFL API
                              const generateResponse = await fetch('/api/generate-image', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  prompt: finalPrompt,
                                  aspect_ratio: '1:1', // Character images are typically square
                                }),
                              });

                              if (!generateResponse.ok) {
                                const errorData = await generateResponse.json();
                                throw new Error(errorData.error || 'Failed to generate image');
                              }

                              const { imageBase64 } = await generateResponse.json();

                              // Upload to R2
                              const uploadResponse = await fetch('/api/upload-character-image', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  imageBase64,
                                  projectId: projectId,
                                }),
                              });

                              if (!uploadResponse.ok) {
                                const errorData = await uploadResponse.json();
                                throw new Error(errorData.error || 'Failed to upload image');
                              }

                              const { imageUrl } = await uploadResponse.json();
                              setCharacterImage(imageUrl);
                            } catch (error: any) {
                              console.error('Error generating character image:', error);
                              alert(`Failed to generate image: ${error.message}`);
                            } finally {
                              setIsGeneratingCharacterImage(false);
                            }
                          }}
                          disabled={isGeneratingCharacterImage}
                          className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingCharacterImage ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Generate Image
                            </>
                          )}
                        </button>
                      </div>
                    )}

                  {/* Reference Images Drag and Drop Area */}
                  <div className="w-full">
                    <h3 className="text-white text-sm font-medium mb-2">Upload Reference</h3>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        
                        const files = Array.from(e.dataTransfer.files).filter(file => 
                          file.type.startsWith('image/')
                        );
                        
                        if (files.length === 0) return;
                        
                        await handleImageUpload(files);
                      }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = async (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (files.length === 0) return;
                          await handleImageUpload(files);
                        };
                        input.click();
                      }}
                      className={`w-full min-h-[120px] border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                        isDragging 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'
                      }`}
                    >
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="text-gray-400 text-xs text-center">
                        {isDragging ? 'Drop images here' : 'Drag & drop images or click to upload'}
                      </p>
                    </div>
                    
                    {/* Reference Images Badges */}
                    {referenceImages.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {referenceImages.map((imageUrl, index) => (
                          <div key={index} className="relative group">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-700 border border-gray-600">
                              <img
                                src={imageUrl}
                                alt={`Reference ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReferenceImages(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Form Fields */}
                <div className="flex-1 space-y-4">
                  {/* Name Field */}
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={characterName}
                      onChange={(e) => setCharacterName(e.target.value)}
                      placeholder=""
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-gray-600"
                    />
                  </div>

                  {/* Character Description Field */}
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Character Description
                    </label>
                    <div className="relative">
                      <p className="text-gray-400 text-xs mb-1">
                        Describe facial features, ethnicity, age, hairstyle here
                      </p>
                      <textarea
                        value={characterDescription}
                        onChange={(e) => setCharacterDescription(e.target.value)}
                        placeholder=""
                        className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-gray-600"
                      />
                    </div>
                  </div>

                  {/* Clothes Field */}
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Clothes
                    </label>
                    <div className="relative">
                      <p className="text-gray-400 text-xs mb-1">
                        Describe shirt, dress, pants, accessories, etc.
                      </p>
                      <textarea
                        value={characterClothes}
                        onChange={(e) => setCharacterClothes(e.target.value)}
                        placeholder=""
                        className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-gray-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {editingCharacter && (
                  <button
                    onClick={async () => {
                      if (!confirm('Are you sure you want to delete this character? This action cannot be undone.')) {
                        return;
                      }
                      
                      try {
                        const { error: deleteError } = await supabase
                          .from('characters')
                          .delete()
                          .eq('id', editingCharacter.id);

                        if (deleteError) {
                          throw deleteError;
                        }

                        // Refresh characters list
                        await fetchCharacters();

                        // Close modal and reset form
                        setShowCharacterModal(false);
                        setEditingCharacter(null);
                        setCharacterName('');
                        setCharacterDescription('');
                        setCharacterClothes('');
                        setCharacterImage(null);
                        setReferenceImages([]);
                      } catch (error: any) {
                        console.error('Error deleting character:', error);
                        alert(`Failed to delete character: ${error.message}`);
                      }
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowCharacterModal(false);
                    setEditingCharacter(null);
                    setCharacterName('');
                    setCharacterDescription('');
                    setCharacterClothes('');
                    setCharacterImage(null);
          setReferenceImages([]);
                  }}
                  className="text-white hover:text-gray-300 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
              <button
                onClick={async () => {
                  if (!characterName.trim()) {
                    alert('Please enter a character name');
                    return;
                  }
 
                  if (isCastEditMode && castEditingIndex !== null) {
                    const updated = [...castCharacters];
                    const updatedCharacter = {
                      ...updated[castEditingIndex],
                      name: characterName.trim(),
                      description: characterDescription.trim() || undefined,
                      clothes: characterClothes.trim() || undefined,
                      image_url: characterImage || null,
                      reference_images: referenceImages.length > 0 ? referenceImages : undefined,
                    };

                    updated[castEditingIndex] = updatedCharacter;
                    setCastCharacters(updated);

                    if (castScenarioAnalysis) {
                      const updatedAnalysis = {
                        ...castScenarioAnalysis,
                        analysis: {
                          ...castScenarioAnalysis.analysis,
                          characters: updated,
                        },
                      };
                      setCastScenarioAnalysis(updatedAnalysis);
                      sessionStorage.setItem(`scenario_analysis_${projectId}`, JSON.stringify(updatedAnalysis));
                    }

                    setShowCharacterModal(false);
                    setEditingCharacter(null);
                    setCharacterName('');
                    setCharacterDescription('');
                    setCharacterClothes('');
                    setCharacterImage(null);
                    setReferenceImages([]);
                    setIsCastEditMode(false);
                    setCastEditingIndex(null);
                    return;
                  }
 
                  try {
                    if (editingCharacter) {
                      // Update existing character
                      const { error: updateError } = await supabase
                        .from('characters')
                        .update({
                          name: characterName.trim(),
                          description: characterDescription.trim() || null,
                          clothes: characterClothes.trim() || null,
                          image_url: characterImage || null,
                          reference_images: referenceImages.length > 0 ? referenceImages : null,
                          updated_at: new Date().toISOString(),
                        })
                        .eq('id', editingCharacter.id);

                      if (updateError) {
                        throw updateError;
                      }
                    } else {
                      // Create new character with project_id
                      const { data: newCharacter, error: characterError } = await supabase
                        .from('characters')
                        .insert({
                          project_id: projectId,
                          name: characterName.trim(),
                          description: characterDescription.trim() || null,
                          clothes: characterClothes.trim() || null,
                          image_url: characterImage || null,
                          reference_images: referenceImages.length > 0 ? referenceImages : null,
                        })
                        .select()
                        .single();

                      if (characterError) {
                        throw characterError;
                      }

                      if (!newCharacter) {
                        throw new Error('Failed to create character');
                      }
                    }

                    // Refresh characters list
                    await fetchCharacters();

                    // Close modal and reset form
                    setShowCharacterModal(false);
                    setEditingCharacter(null);
                    setCharacterName('');
                    setCharacterDescription('');
                    setCharacterClothes('');
                    setCharacterImage(null);
          setReferenceImages([]);
                  } catch (error: any) {
                    console.error('Error saving character:', error);
                    alert(`Failed to save character: ${error.message}`);
                  }
                }}
                className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors text-sm font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
                disabled={!characterName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

