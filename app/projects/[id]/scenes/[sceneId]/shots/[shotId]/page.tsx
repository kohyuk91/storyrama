'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface ShotData {
  id: string;
  scene_id: string;
  order_index: number;
  image_url: string | null;
  script: string | null;
  thumbnail: string | null;
  node_graph?: {
    nodes: Node[];
    edges: Edge[];
  } | null;
  created_at: string;
  updated_at: string;
}

interface SceneData {
  id: string;
  project_id: string;
  name: string;
  order_index: number;
}

interface ProjectData {
  id: string;
  aspect_ratio: '16:9' | '1:1' | '9:16';
}

interface ShotImage {
  id: string;
  shot_id: string;
  image_url: string;
  prompt: string | null;
  is_primary: boolean;
  created_at: string;
}

// Custom Generate Image Node Component
function GenerateImageNode({ data, id, selected }: NodeProps) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!bg-black !border-2 !border-gray-700 !w-3 !h-3" />
      <div 
        className={`bg-[#E67E22] rounded-full px-8 py-4 shadow-lg flex items-center gap-3 min-w-[200px] transition-all duration-200 ${
          selected ? 'ring-2 ring-blue-500 ring-opacity-75 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : ''
        }`}
      >
        {/* Mountain and sun icon */}
        <div className="flex-shrink-0 w-8 h-8 bg-black rounded flex items-center justify-center p-1">
          <svg 
            className="w-full h-full text-white" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            {/* Mountain silhouette - multiple peaks */}
            <path d="M2 20h4l2-4 2 4h2l2-4 2 4h2l2-4 2 4h4V20H2z" />
            {/* Sun circle in top right */}
            <circle cx="18" cy="4" r="2.5" fill="currentColor" />
          </svg>
        </div>
        {/* Text */}
        <span className="text-black font-medium text-sm whitespace-nowrap">Generate Image</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-black !border-2 !border-gray-700 !w-3 !h-3" />
    </div>
  );
}

// Custom Combine Images Node Component
function CombineImagesNode({ data, id, selected }: NodeProps) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!bg-black !border-2 !border-gray-700 !w-3 !h-3" />
      <div 
        className={`bg-[#D98C5B] rounded-full px-8 py-4 shadow-lg flex items-center gap-3 min-w-[200px] transition-all duration-200 ${
          selected ? 'ring-2 ring-blue-500 ring-opacity-75 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : ''
        }`}
      >
        {/* Stacked images icon */}
        <div className="flex-shrink-0 w-8 h-8 bg-black rounded flex items-center justify-center p-1 relative">
          <svg 
            className="w-full h-full text-white" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            {/* Bottom-left rectangle */}
            <rect x="3" y="10" width="9" height="11" fill="currentColor" />
            {/* Top-right rectangle (offset) */}
            <rect x="9" y="5" width="9" height="11" fill="currentColor" />
            {/* Small dot on top-right corner of top-right rectangle */}
            <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
          </svg>
        </div>
        {/* Text */}
        <span className="text-black font-medium text-sm whitespace-nowrap">Combine Images</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-black !border-2 !border-gray-700 !w-3 !h-3" />
    </div>
  );
}

const nodeTypes = {
  generateImage: GenerateImageNode,
  combineImages: CombineImagesNode,
};

// Inner component that uses useReactFlow hook (must be inside ReactFlowProvider)
function FlowEditorInner({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  onConnect,
  onPaneContextMenu,
  contextMenu,
  onAddNode,
  onCloseContextMenu,
  selectedNode,
  onNodeSelect,
  onGenerateImage,
  isGenerating,
  setIsGenerating,
  project,
  shotId,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: (params: Connection) => void;
  onPaneContextMenu: (event: any) => void;
  contextMenu: { x: number; y: number; flowX: number; flowY: number } | null;
  onAddNode: (type: 'generateImage' | 'combineImages', position: { x: number; y: number }) => void;
  onCloseContextMenu: () => void;
  selectedNode: Node | null;
  onNodeSelect: (node: Node | null) => void;
  onGenerateImage: (nodeId: string, input: string, imageUrl: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  project: ProjectData | null;
  shotId: string;
}) {
  const { screenToFlowPosition, setNodes } = useReactFlow();

  const handleContextMenuClick = (type: 'generateImage' | 'combineImages') => {
    if (contextMenu) {
      // Convert screen coordinates to flow coordinates
      const position = screenToFlowPosition({
        x: contextMenu.x,
        y: contextMenu.y,
      });
      onAddNode(type, position);
    }
  };

  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    onNodeSelect(node);
  };

  const handlePaneClick = () => {
    onNodeSelect(null);
  };

  // Get connected nodes info
  const getConnectedNodesInfo = (nodeId: string) => {
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    const outgoingEdges = edges.filter(edge => edge.source === nodeId);
    return {
      in: incomingEdges.length,
      out: outgoingEdges.length,
    };
  };

  return (
    <div className="relative w-full h-full" onClick={onCloseContextMenu}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-900"
      >
        <Background />
        <Controls />
      </ReactFlow>
      
      {/* Properties Panel */}
      {selectedNode && (
        <div className="absolute top-4 right-4 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-white font-semibold text-lg">
              {selectedNode.type === 'generateImage' ? 'Generate Image' : 
               selectedNode.type === 'combineImages' ? 'Combine Images' : 'Node'}
            </h3>
          </div>
          
          <div className="p-4 space-y-4">
            {selectedNode.type === 'combineImages' && (
              <>
                {/* Model */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Model</label>
                  <div className="relative">
                    <div className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm flex items-center justify-between cursor-pointer hover:border-gray-600 transition-colors">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                        <span>Flux Kontext Pro</span>
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Input */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Input</label>
                  <div className="relative">
                    <textarea
                      placeholder="Enter your message here..."
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-gray-600 mb-2 pr-12"
                      rows={4}
                      value={(selectedNode.data?.input as string) || ''}
                      onChange={(e) => {
                        // Update node data
                        setNodes((nds) =>
                          nds.map((node) =>
                            node.id === selectedNode.id
                              ? { ...node, data: { ...node.data, input: e.target.value } }
                              : node
                          )
                        );
                        // Update selected node state
                        onNodeSelect({
                          ...selectedNode,
                          data: { ...selectedNode.data, input: e.target.value },
                        });
                      }}
                    />
                    {/* Submit Button */}
                    <div className="absolute bottom-4 right-3">
                      <button
                        className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors shadow-lg"
                        title="Process"
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
                
                {/* Output */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Output</label>
                  <div className="relative">
                    {selectedNode.data?.output ? (
                      <div className="bg-gray-900 border border-gray-700 rounded-lg p-2">
                        <img
                          src={selectedNode.data.output as string}
                          alt="Combined"
                          className="w-full h-auto rounded-lg max-h-[200px] object-contain"
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        readOnly
                        value="No input"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-500 text-sm"
                      />
                    )}
                  </div>
                </div>
              </>
            )}
            {selectedNode.type === 'generateImage' && (
              <>
                {/* Model */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Model</label>
                  <div className="relative">
                    <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm appearance-none cursor-pointer hover:border-gray-600 transition-colors">
                      <option>Flux Dev</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Input */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Input</label>
                  <textarea
                    placeholder="Enter your message here..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-gray-600 mb-2"
                    rows={4}
                    value={(selectedNode.data?.input as string) || ''}
                    onChange={(e) => {
                      // Update node data
                      setNodes((nds) =>
                        nds.map((node) =>
                          node.id === selectedNode.id
                            ? { ...node, data: { ...node.data, input: e.target.value } }
                            : node
                        )
                      );
                      // Update selected node state
                      onNodeSelect({
                        ...selectedNode,
                        data: { ...selectedNode.data, input: e.target.value },
                      });
                    }}
                  />
                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        const input = (selectedNode.data?.input as string) || '';
                        if (!input.trim()) {
                          alert('Please enter a prompt');
                          return;
                        }
                        if (!project?.aspect_ratio) {
                          alert('Project aspect ratio not found');
                          return;
                        }
                        
                        setIsGenerating(true);
                        try {
                          // Step 1: Generate image using BFL API
                          const generateResponse = await fetch('/api/generate-image', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                              prompt: input,
                              aspect_ratio: project.aspect_ratio,
                            }),
                          });

                          if (!generateResponse.ok) {
                            const errorData = await generateResponse.json();
                            throw new Error(errorData.error || 'Failed to generate image');
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
                            throw new Error(errorData.error || 'Failed to upload image');
                          }

                          const { imageUrl } = await uploadResponse.json();

                          // Step 3: Update node output and save to database
                          onGenerateImage(selectedNode.id, input, imageUrl);
                        } catch (error: any) {
                          console.error('Error generating image:', error);
                          alert(`Failed to generate image: ${error.message}`);
                        } finally {
                          setIsGenerating(false);
                        }
                      }}
                      disabled={isGenerating || !(selectedNode.data?.input as string)?.trim()}
                      className="w-10 h-10 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors shadow-lg"
                      title="Generate image"
                    >
                      {isGenerating ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
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
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Output */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Output</label>
                  <div className="relative">
                    {selectedNode.data?.output ? (
                      <div className="bg-gray-900 border border-gray-700 rounded-lg p-2">
                        <img
                          src={selectedNode.data.output as string}
                          alt="Generated"
                          className="w-full h-auto rounded-lg max-h-[200px] object-contain"
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        readOnly
                        value="No input"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm pr-10"
                      />
                    )}
                  </div>
                </div>
              </>
            )}
            
            {/* Connected Nodes */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">Connected Nodes</label>
              <p className="text-gray-400 text-sm">
                {(() => {
                  const connected = getConnectedNodesInfo(selectedNode.id);
                  return `${connected.in} In, ${connected.out} Out`;
                })()}
              </p>
            </div>
          </div>
        </div>
      )}
      {contextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-2 z-50 min-w-[180px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
            <button
              onClick={() => handleContextMenuClick('generateImage')}
              className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 transition-colors text-sm"
            >
              Add Generate Image Node
            </button>
            <button
              onClick={() => handleContextMenuClick('combineImages')}
              className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 transition-colors text-sm"
            >
              Add Combine Images Node
            </button>
        </div>
      )}
    </div>
  );
}

// Wrapper component that provides ReactFlowProvider
function FlowEditor({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  onConnect,
  onPaneContextMenu,
  contextMenu,
  onAddNode,
  onCloseContextMenu,
  selectedNode,
  onNodeSelect,
  onGenerateImage,
  isGenerating,
  setIsGenerating,
  project,
  shotId,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: (params: Connection) => void;
  onPaneContextMenu: (event: any) => void;
  contextMenu: { x: number; y: number; flowX: number; flowY: number } | null;
  onAddNode: (type: 'generateImage' | 'combineImages', position: { x: number; y: number }) => void;
  onCloseContextMenu: () => void;
  selectedNode: Node | null;
  onNodeSelect: (node: Node | null) => void;
  onGenerateImage: (nodeId: string, input: string, imageUrl: string) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  project: ProjectData | null;
  shotId: string;
}) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        contextMenu={contextMenu}
        onAddNode={onAddNode}
        onCloseContextMenu={onCloseContextMenu}
        selectedNode={selectedNode}
        onNodeSelect={onNodeSelect}
        onGenerateImage={onGenerateImage}
        isGenerating={isGenerating}
        setIsGenerating={setIsGenerating}
        project={project}
        shotId={shotId}
      />
    </ReactFlowProvider>
  );
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
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [shotImages, setShotImages] = useState<ShotImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nodeGraphSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    flowX: number;
    flowY: number;
  } | null>(null);
  
  // Selected node state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

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
              // Fallback to original script if API fails
              return script.trim();
            }

            const { cleanedPrompt } = await response.json();
            return cleanedPrompt || script.trim();
          } catch (error) {
            console.error('Error calling clean-prompt API:', error);
            // Fallback to original script if API fails
            return script.trim();
          }
        };
        
        // Load node graph from database
        if (shotData.node_graph && shotData.node_graph.nodes && shotData.node_graph.nodes.length > 0) {
          // Load saved node graph
          setNodes(shotData.node_graph.nodes);
          setEdges(shotData.node_graph.edges || []);
        } else {
          // If no node graph exists, create default GenerateImageNode with cleaned script as input
          const cleanedPrompt = await cleanPromptForImageGeneration(shotData.script || '');
          const defaultNode: Node = {
            id: `generateImage-${Date.now()}`,
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
          
          setNodes([defaultNode] as any);
          setEdges([] as any);
          
          // Save default node graph to database
          const { error: updateError } = await supabase
            .from('shots')
            .update({ node_graph: defaultNodeGraph })
            .eq('id', shotId);
          
          if (updateError) {
            console.error('Error saving default node graph:', updateError);
          }
        }

        // Fetch shot images
        const { data: imagesData, error: imagesError } = await supabase
          .from('shot_images')
          .select('*')
          .eq('shot_id', shotId)
          .order('created_at', { ascending: false });

        if (imagesError) {
          console.error('Error fetching shot images:', imagesError);
        } else {
          setShotImages(imagesData || []);
        }

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

        // Fetch project data including aspect_ratio
        if (sceneData) {
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('id, user_id, aspect_ratio')
            .eq('id', projectId)
            .eq('user_id', user.id)
            .single();

          if (projectError || !projectData) {
            setError('Project not found or you do not have access');
            setIsLoading(false);
            return;
          }

          setProject(projectData);
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

  // Save node graph to database when nodes or edges change
  useEffect(() => {
    if (!shotId || !shot) return;

    // Clear existing timeout
    if (nodeGraphSaveTimeoutRef.current) {
      clearTimeout(nodeGraphSaveTimeoutRef.current);
    }

    // Debounce save operation (1 second delay)
    nodeGraphSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const nodeGraph = {
          nodes: nodes,
          edges: edges,
        };

        const { error: updateError } = await supabase
          .from('shots')
          .update({ node_graph: nodeGraph })
          .eq('id', shotId);

        if (updateError) {
          console.error('Error saving node graph:', updateError);
        } else {
          // Update local shot state
          setShot(prev => prev ? { ...prev, node_graph: nodeGraph } : null);
        }
      } catch (err) {
        console.error('Error saving node graph:', err);
      }
    }, 1000);

    // Cleanup timeout on unmount
    return () => {
      if (nodeGraphSaveTimeoutRef.current) {
        clearTimeout(nodeGraphSaveTimeoutRef.current);
      }
    };
  }, [nodes, edges, shotId, shot]);

  // Auto-set primary image when there's exactly 1 image
  useEffect(() => {
    if (!shotId || shotImages.length !== 1) return;

    const singleImage = shotImages[0];
    
    // If the single image is not primary, set it as primary
    if (!singleImage.is_primary) {
      supabase
        .from('shot_images')
        .update({ is_primary: true })
        .eq('id', singleImage.id)
        .then(({ error }) => {
          if (!error) {
            // Update local state
            setShotImages((prev) =>
              prev.map((img) => ({
                ...img,
                is_primary: img.id === singleImage.id,
              }))
            );
          }
        });
    }
  }, [shotImages, shotId]);

  // Update thumbnail when primary image changes
  useEffect(() => {
    if (!shotId || !shot) return;

    const primaryImage = shotImages.find(img => img.is_primary);
    
    if (primaryImage) {
      // Update thumbnail to primary image
      if (shot.thumbnail !== primaryImage.image_url) {
        supabase
          .from('shots')
          .update({ thumbnail: primaryImage.image_url })
          .eq('id', shotId)
          .then(({ error }) => {
            if (!error) {
              setShot(prev => prev ? { ...prev, thumbnail: primaryImage.image_url } : null);
            }
          });
      }
    } else if (shot.thumbnail !== null) {
      // If no primary image, clear thumbnail
      supabase
        .from('shots')
        .update({ thumbnail: null })
        .eq('id', shotId)
        .then(({ error }) => {
          if (!error) {
            setShot(prev => prev ? { ...prev, thumbnail: null } : null);
          }
        });
    }
  }, [shotImages, shotId, shot]);

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

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handlePaneContextMenu = useCallback(
    (event: any) => {
      event.preventDefault();
      // React Flow provides detail with x, y in flow coordinates
      const flowX = event.detail?.x ?? event.clientX;
      const flowY = event.detail?.y ?? event.clientY;
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowX,
        flowY,
      });
    },
    []
  );

  const handleAddNode = useCallback(
    (type: 'generateImage' | 'combineImages', position: { x: number; y: number }) => {
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {},
      };
      setNodes((nds: Node[]) => [...nds, newNode] as any);
      setContextMenu(null);
    },
    [setNodes]
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleNodeSelect = useCallback((node: Node | null) => {
    setSelectedNode(node);
  }, []);

  const handleGenerateImageFromNode = useCallback(
    async (nodeId: string, input: string, imageUrl: string) => {
      try {
        // Update node output
        setNodes((nds: Node[]) =>
          nds.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, output: imageUrl } }
              : node
          ) as any
        );

        // Update selected node if it's the same node
        if (selectedNode && selectedNode.id === nodeId) {
          setSelectedNode({
            ...selectedNode,
            data: { ...selectedNode.data, output: imageUrl },
          });
        }

        // Save image to shot_images table
        const { data: newImage, error: insertError } = await supabase
          .from('shot_images')
          .insert({
            shot_id: shotId,
            image_url: imageUrl,
            prompt: input,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error saving image to database:', insertError);
        } else {
          // Update local state
          const updatedImages = [{ ...newImage, is_primary: newImage.is_primary || false }, ...shotImages];
          setShotImages(updatedImages);
        }
      } catch (error: any) {
        console.error('Error updating node with image:', error);
      }
    },
    [setNodes, selectedNode, shotId, shotImages]
  );

  // Sync selectedNode with nodes array when nodes change
  useEffect(() => {
    if (selectedNode) {
      const updatedNode = (nodes as Node[]).find((n: Node) => n.id === selectedNode.id);
      if (updatedNode) {
        setSelectedNode(updatedNode);
      } else {
        // Node was deleted
        setSelectedNode(null);
      }
    }
  }, [nodes, selectedNode?.id]);

  // Set primary image (representative image)
  const handleSetPrimaryImage = useCallback(
    async (imageId: string) => {
      if (!shotId) return;

      try {
        // Find the image to set as primary
        const targetImage = shotImages.find((img) => img.id === imageId);
        if (!targetImage) {
          console.error('Image not found');
          return;
        }

        // First, unset all other primary images for this shot
        const { error: unsetError } = await supabase
          .from('shot_images')
          .update({ is_primary: false })
          .eq('shot_id', shotId);

        if (unsetError) {
          console.error('Error unsetting primary images:', unsetError);
          return;
        }

        // Set the selected image as primary
        const { error: setError } = await supabase
          .from('shot_images')
          .update({ is_primary: true })
          .eq('id', imageId);

        if (setError) {
          console.error('Error setting primary image:', setError);
          return;
        }

        // Update local state
        setShotImages((prev) =>
          prev.map((img) => ({
            ...img,
            is_primary: img.id === imageId,
          }))
        );

        // Update shot thumbnail
        const { error: thumbnailError } = await supabase
          .from('shots')
          .update({ thumbnail: targetImage.image_url })
          .eq('id', shotId);

        if (!thumbnailError) {
          setShot((prev) =>
            prev ? { ...prev, thumbnail: targetImage.image_url } : null
          );
        }
      } catch (error: any) {
        console.error('Error setting primary image:', error);
      }
    },
    [shotId, shotImages]
  );

  const handleGenerateImage = async () => {
    if (!prompt.trim() || !shotId) {
      alert('Please enter a prompt');
      return;
    }

    if (!project?.aspect_ratio) {
      alert('Project aspect ratio not found');
      return;
    }

    setIsGenerating(true);
    try {
      // Step 1: Generate image using BFL API with project aspect ratio
      const generateResponse = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          aspect_ratio: project.aspect_ratio,
        }),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error || 'Failed to generate image');
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
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const { imageUrl } = await uploadResponse.json();

      // Step 3: Save image URL to database
      const { data: newImage, error: insertError } = await supabase
        .from('shot_images')
        .insert({
          shot_id: shotId,
          image_url: imageUrl,
          prompt: prompt,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Update local state
      const updatedImages = [newImage, ...shotImages];
      setShotImages(updatedImages);

      // Also update the shot's main image_url if it's the first image
      if (shotImages.length === 0 && !shot?.image_url) {
        const { error: updateError } = await supabase
          .from('shots')
          .update({ image_url: imageUrl })
          .eq('id', shotId);

        if (!updateError) {
          setShot(prev => prev ? { ...prev, image_url: imageUrl } : null);
        }
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      alert(`Failed to generate image: ${error.message}`);
    } finally {
      setIsGenerating(false);
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
        {/* Left Section - React Flow Node Editor */}
        <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden relative">
          <FlowEditor
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneContextMenu={handlePaneContextMenu}
            contextMenu={contextMenu}
            onAddNode={handleAddNode}
            onCloseContextMenu={handleCloseContextMenu}
            selectedNode={selectedNode}
            onNodeSelect={handleNodeSelect}
            onGenerateImage={handleGenerateImageFromNode}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
            project={project}
            shotId={shotId}
          />
        </div>
        
        {/* Right Sidebar - Images (250px width) */}
        <div className="w-[250px] bg-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <p className="text-white text-lg font-semibold">IMAGES</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {shotImages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No images generated yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {shotImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative w-full bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity group"
                    onClick={() => {
                      // Update main image viewer
                      if (shot) {
                        setShot({ ...shot, image_url: image.image_url });
                        // Also update in database
                        supabase
                          .from('shots')
                          .update({ image_url: image.image_url })
                          .eq('id', shotId);
                      }
                    }}
                  >
                    <img
                      src={image.image_url}
                      alt={image.prompt || 'Generated image'}
                      className="w-full h-auto object-contain"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                      <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    {/* Crown button - top right, visible on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetPrimaryImage(image.id);
                      }}
                      className={`absolute top-2 right-2 p-2 rounded-full transition-all ${
                        image.is_primary
                          ? 'bg-yellow-500 opacity-100'
                          : 'bg-gray-800 opacity-0 group-hover:opacity-100 hover:bg-yellow-600'
                      }`}
                      title={image.is_primary ? 'Primary image' : 'Set as primary image'}
                    >
                      <svg
                        className="w-5 h-5 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.07 1L12 10l4.93 7H7.07z" />
                        <path d="M12 2L8 8h8L12 2z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

