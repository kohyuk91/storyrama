'use client';

interface ShotProps {
  id: string;
  shotNumber: number;
  imageUrl?: string;
  script?: string;
  onClick?: () => void;
}

export default function Shot({ id, shotNumber, imageUrl, script, onClick }: ShotProps) {
  return (
    <div 
      className="relative flex items-center justify-center bg-gray-800 border-2 border-white rounded cursor-pointer hover:bg-gray-700 transition-colors h-[250px]"
      onClick={onClick}
    >
      {/* Pill Badge - Top Left */}
      <div className="absolute top-2 left-2 bg-white rounded-full px-3 py-1">
        <span className="text-black font-bold text-sm uppercase tracking-wide">
          SHOT {shotNumber}
        </span>
      </div>
      
      {/* Image or Empty Space */}
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={`Shot ${shotNumber}`}
          className="w-full h-full object-cover rounded"
        />
      ) : null}
    </div>
  );
}

