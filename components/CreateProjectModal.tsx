'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: () => void;
}

const artStyles = [
  { name: 'Cinematic', image: '/api/placeholder/200/150' },
  { name: 'Sketch', image: '/api/placeholder/200/150' },
  { name: 'Japanese Ink Painting', image: '/api/placeholder/200/150' },
  { name: 'Dynamic Ink', image: '/api/placeholder/200/150' },
  { name: 'Computer Animation', image: '/api/placeholder/200/150' },
  { name: 'Pencil Drawing', image: '/api/placeholder/200/150' },
  { name: 'Cartoon', image: '/api/placeholder/200/150' },
  { name: 'Childrens Illustration', image: '/api/placeholder/200/150' },
];

export default function CreateProjectModal({ isOpen, onClose, onProjectCreated }: CreateProjectModalProps) {
  const { user } = useUser();
  const [projectName, setProjectName] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '9:16'>('16:9');
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>('Cinematic');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setProjectName('');
      setAspectRatio('16:9');
      setSelectedArtStyle('Cinematic');
      setCurrentPage(1);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isProjectNameValid = projectName.trim().length > 0;

  const handleCreate = async () => {
    if (!isProjectNameValid || isLoading) return;
    
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert([
          {
            name: projectName.trim(),
            aspect_ratio: aspectRatio,
            art_style: selectedArtStyle,
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      console.log('Project created successfully:', data);
      
      // Create default SCENE 1 for the new project
      if (data?.id) {
        const { data: newScene, error: sceneError } = await supabase
          .from('scenes')
          .insert([
            {
              project_id: data.id,
              name: 'SCENE 1',
              order_index: 0,
            },
          ])
          .select()
          .single();

        if (sceneError) {
          console.error('Error creating default scene:', sceneError);
          // Don't throw error, just log it - project is still created
        } else if (newScene?.id) {
          // Create default SHOT 1 for the new scene
          const { error: shotError } = await supabase
            .from('shots')
            .insert([
              {
                scene_id: newScene.id,
                order_index: 0,
              },
            ]);

          if (shotError) {
            console.error('Error creating default shot:', shotError);
            // Don't throw error, just log it - scene is still created
          }
        }
      }
      
      // Reset form
      setProjectName('');
      setAspectRatio('16:9');
      setSelectedArtStyle('Cinematic');
      
      // Close modal
      onClose();
      
      // Refresh projects list
      if (onProjectCreated) {
        onProjectCreated();
      }
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || '프로젝트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const displayedStyles = artStyles.slice((currentPage - 1) * 8, currentPage * 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Create a new project</h2>
          
          {/* Project Name */}
          <div className="mb-6">
            <label className="block text-white mb-2 font-medium">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="New Project"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Aspect Ratio */}
          <div className="mb-6">
            <label className="block text-white mb-3 font-medium">Aspect Ratio</label>
            <div className="flex gap-3">
              <button
                onClick={() => setAspectRatio('16:9')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  aspectRatio === '16:9'
                    ? 'border-pink-500 bg-pink-500/10 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect width="16" height="9" x="4" y="7.5" rx="1" />
                </svg>
                <span>16:9 Landscape</span>
              </button>
              <button
                onClick={() => setAspectRatio('1:1')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  aspectRatio === '1:1'
                    ? 'border-pink-500 bg-pink-500/10 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect width="12" height="12" x="6" y="6" rx="1" />
                </svg>
                <span>1:1 Square</span>
              </button>
              <button
                onClick={() => setAspectRatio('9:16')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  aspectRatio === '9:16'
                    ? 'border-pink-500 bg-pink-500/10 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect width="9" height="16" x="7.5" y="4" rx="1" />
                </svg>
                <span>9:16 Portrait</span>
              </button>
            </div>
          </div>

          {/* Art Style */}
          <div className="mb-6">
            <label className="block text-white mb-3 font-medium">Select Art Style</label>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {displayedStyles.map((style) => (
                <button
                  key={style.name}
                  onClick={() => setSelectedArtStyle(style.name)}
                  className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                    selectedArtStyle === style.name
                      ? 'border-pink-500'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="aspect-video bg-gray-800 flex items-center justify-center">
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                    <p
                      className={`text-sm font-medium text-center ${
                        selectedArtStyle === style.name ? 'text-pink-400' : 'text-white'
                      }`}
                    >
                      {style.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(1)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  currentPage === 1
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                1
              </button>
              <button
                onClick={() => setCurrentPage(2)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  currentPage === 2
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                2
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(2, currentPage + 1))}
                disabled={currentPage === 2}
                className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Create Button */}
          <div className="flex justify-end mt-6">
            <button
              onClick={handleCreate}
              disabled={!isProjectNameValid || isLoading}
              className={`px-6 py-3 text-white font-semibold rounded-lg transition-colors ${
                isProjectNameValid && !isLoading
                  ? 'bg-pink-500 hover:bg-pink-600 cursor-pointer'
                  : 'bg-gray-700 cursor-not-allowed opacity-50'
              }`}
            >
              {isLoading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

