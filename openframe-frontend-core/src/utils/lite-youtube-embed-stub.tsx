import React from 'react';

export interface LiteYouTubeEmbedProps {
  id: string;
  title?: string;
  poster?: string;
  className?: string;
}

export function LiteYouTubeEmbed({ id, title, poster, className }: LiteYouTubeEmbedProps) {
  return (
    <div className={className}>
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}