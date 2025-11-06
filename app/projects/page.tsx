'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import CreateProjectModal from '@/components/CreateProjectModal';
import { supabase } from '@/lib/supabase';

interface Project {
  id: string;
  name: string;
  aspect_ratio: '16:9' | '1:1' | '9:16';
  art_style: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useUser();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch projects from database
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching projects:', error);
        } else {
          setProjects(data || []);
        }
      } catch (err) {
        console.error('Error fetching projects:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleProjectCreated = () => {
    // Refresh projects list after creation
    const fetchProjects = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching projects:', error);
        } else {
          setProjects(data || []);
        }
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };

    fetchProjects();
  };

  const handleCreateProject = (type: 'ai-guided' | 'blank') => {
    setIsDropdownOpen(false);
    if (type === 'blank') {
      setIsModalOpen(true);
    } else {
      console.log(`Create ${type} project`);
      // AI Guided 프로젝트 생성 로직 추가
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event
    
    if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project');
      } else {
        // Refresh projects list
        const { data, error: fetchError } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching projects:', fetchError);
        } else {
          setProjects(data || []);
        }
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Projects
          </h1>
          <div className="relative" ref={dropdownRef}>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm flex items-center gap-2"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              + Create Project
              <svg
                className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="py-1">
                  <button
                    className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg"
                    onClick={() => handleCreateProject('ai-guided')}
                  >
                    <div className="font-medium">AI Guided Project</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      AI의 도움을 받아 프로젝트 생성
                    </div>
                  </button>
                  <button
                    className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors last:rounded-b-lg"
                    onClick={() => handleCreateProject('blank')}
                  >
                    <div className="font-medium">Blank Project</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      빈 프로젝트로 시작
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-12">
              No projects yet. Create your first project!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-pink-500 hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300 cursor-pointer"
                >
                  {/* Delete Button - Appears on hover */}
                  <button
                    onClick={(e) => handleDeleteProject(project.id, project.name, e)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg z-10"
                    title="Delete project"
                  >
                    <svg 
                      className="w-4 h-4" 
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

                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {project.name}
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Aspect Ratio:</span>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                        {project.aspect_ratio}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Art Style:</span>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                        {project.art_style}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                      Created: {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <CreateProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
    </main>
  );
}

