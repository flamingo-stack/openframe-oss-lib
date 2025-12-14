import React from 'react';

interface LiteYouTubeEmbedProps {
  id: string;
  title?: string;
  thumbnail?: string;
  className?: string;
}

export function LiteYouTubeEmbed({ id, title = 'YouTube video', thumbnail, className }: LiteYouTubeEmbedProps) {
  const [isLoaded, setIsLoaded] = React.useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  if (isLoaded) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title={title}
        className={className}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <div 
      className={`cursor-pointer relative ${className}`}
      onClick={handleLoad}
    >
      <img 
        src={thumbnail || `https://img.youtube.com/vi/${id}/maxresdefault.jpg`}
        alt={title}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
          <div className="w-0 h-0 border-l-8 border-l-white border-t-4 border-t-transparent border-b-4 border-b-transparent ml-1" />
        </div>
      </div>
    </div>
  );
}