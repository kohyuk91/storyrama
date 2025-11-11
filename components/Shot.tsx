'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface ShotProps {
  id: string;
  shotNumber: number;
  imageUrl?: string;
  script?: string;
  onClick?: () => void;
  isGenerating?: boolean;
}

interface ShotImage {
  id: string;
  shot_id: string;
  image_url: string;
  prompt: string | null;
  is_primary: boolean;
  created_at: string;
}

export default function Shot({ id, shotNumber, imageUrl, script, onClick, isGenerating = false }: ShotProps) {
  const [showImages, setShowImages] = useState(false);
  const [images, setImages] = useState<ShotImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentThumbnail, setCurrentThumbnail] = useState<string | undefined>(imageUrl);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Update currentThumbnail when imageUrl prop changes
  useEffect(() => {
    setCurrentThumbnail(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowImages(false);
      }
    };

    if (showImages) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
  }, [showImages]);

  // Set selected image index when images are loaded
  useEffect(() => {
    if (images.length > 0 && selectedImageIndex >= images.length) {
      setSelectedImageIndex(0);
    }
  }, [images, selectedImageIndex]);

  const handleImagesClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (images.length === 0 && !isLoadingImages) {
      setIsLoadingImages(true);
      try {
        const { data, error } = await supabase
          .from('shot_images')
          .select('*')
          .eq('shot_id', id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching images:', error);
        } else {
          setImages(data || []);
        }
      } catch (err) {
        console.error('Error fetching images:', err);
      } finally {
        setIsLoadingImages(false);
      }
    }
    
    setShowImages(!showImages);
  };

  const handleSetPrimaryImage = async (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      // Find the image to set as primary
      const targetImage = images.find((img) => img.id === imageId);
      if (!targetImage) {
        console.error('Image not found');
        return;
      }

      // First, unset all other primary images for this shot
      const { error: unsetError } = await supabase
        .from('shot_images')
        .update({ is_primary: false })
        .eq('shot_id', id);

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
      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          is_primary: img.id === imageId,
        }))
      );

      // Update shot thumbnail
      const { error: thumbnailError } = await supabase
        .from('shots')
        .update({ thumbnail: targetImage.image_url })
        .eq('id', id);

      if (thumbnailError) {
        console.error('Error updating thumbnail:', thumbnailError);
      } else {
        // Update local thumbnail state immediately for real-time update
        setCurrentThumbnail(targetImage.image_url);
      }
    } catch (error: any) {
      console.error('Error setting primary image:', error);
    }
  };

  return (
    <div 
      className="relative flex items-center justify-center bg-gray-800 border-2 border-white/50 rounded cursor-pointer hover:bg-gray-700 transition-colors h-[250px] group"
      onClick={onClick}
    >
      {/* Pill Badge - Top Left */}
      <div className="absolute top-2 left-2 bg-white rounded-full px-3 py-1 z-10">
        <span className="text-black font-bold text-sm uppercase tracking-wide">
          SHOT {shotNumber}
        </span>
      </div>
      
      {/* Spinning Wheel Overlay - When generating */}
      {isGenerating && (
        <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center z-30">
          <svg className="animate-spin h-12 w-12 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
      
      {/* Image or Empty Space */}
      {currentThumbnail ? (
        <img 
          src={currentThumbnail} 
          alt={`Shot ${shotNumber}`}
          className={`w-full h-full object-cover rounded ${isGenerating ? 'opacity-50' : ''}`}
        />
      ) : null}

      {/* Images Icon Button - Bottom Right, visible on hover */}
      <button
        ref={buttonRef}
        onClick={handleImagesClick}
        className="absolute bottom-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg"
        title="View images"
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
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {/* Full Screen Image Viewer Modal */}
      {showImages && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 z-50 flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImages(false);
            }
          }}
        >
          <div
            ref={popupRef}
            className="w-full h-full flex"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Side - Main Image Viewer */}
            <div className="flex-1 relative bg-black flex items-center justify-center">
              {images.length > 0 && selectedImageIndex < images.length && (
                <>
                  <img
                    src={images[selectedImageIndex].image_url}
                    alt={images[selectedImageIndex].prompt || 'Image'}
                    className="max-w-full max-h-full object-contain"
                  />
                  {/* Close button - top right */}
                  <button
                    onClick={() => setShowImages(false)}
                    className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors z-10"
                    title="Close"
                  >
                    <svg
                      className="w-6 h-6 text-white"
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
                </>
              )}
            </div>

            {/* Right Sidebar - Image List */}
            <div className="w-64 bg-gray-900 border-l border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">Images ({images.length})</h3>
                  <button
                    onClick={() => setShowImages(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Close"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {isLoadingImages ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">Loading...</p>
                  </div>
                ) : images.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">No images</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {images.map((image, index) => (
                      <div
                        key={image.id}
                        className={`relative w-full bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all group/image ${
                          index === selectedImageIndex
                            ? 'ring-2 ring-blue-500'
                            : 'hover:opacity-80'
                        }`}
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <img
                          src={image.image_url}
                          alt={image.prompt || 'Image'}
                          className="w-full h-auto object-contain"
                        />
                        {/* Crown button - top right, visible on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPrimaryImage(image.id, e);
                          }}
                          className={`absolute top-2 right-2 p-1.5 rounded-full transition-all z-10 ${
                            image.is_primary
                              ? 'bg-yellow-500 opacity-100'
                              : 'bg-gray-800 opacity-0 group-hover/image:opacity-100 hover:bg-yellow-600'
                          }`}
                          title={image.is_primary ? 'Primary image' : 'Set as primary image'}
                        >
                          <svg
                            className="w-4 h-4 text-white"
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
          </div>
        </div>
      )}
    </div>
  );
}

