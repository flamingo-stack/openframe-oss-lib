'use client';

import { useState, useEffect } from 'react';
import { Modal, Button } from './index';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

interface ImageGalleryModalProps {
  images: string[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
}

/**
 * Full-screen image gallery modal
 * Reusable component extracted from TMCG event detail page
 * Features: Keyboard navigation, prev/next buttons, image counter
 */
export function ImageGalleryModal({
  images,
  isOpen,
  onClose,
  initialIndex = 0,
}: ImageGalleryModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(initialIndex);

  // Reset to initial index when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedImageIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const goToPreviousImage = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (selectedImageIndex < images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToPreviousImage();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNextImage();
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => {
        document.removeEventListener('keydown', handleKeyPress);
      };
    }
  }, [isOpen, selectedImageIndex, images.length]);

  if (!isOpen || images.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[95vw]"
    >
      <div className="relative flex items-center justify-center bg-black rounded-lg">
        {/* Navigation Buttons */}
        {images.length > 1 && (
          <>
            {selectedImageIndex > 0 && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-[10000]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPreviousImage}
                  className="rounded-full bg-black/50 text-white hover:bg-black/70 p-2"
                  leftIcon={<ChevronLeft className="w-6 h-6" />}
                />
              </div>
            )}
            {selectedImageIndex < images.length - 1 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[10000]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextImage}
                  className="rounded-full bg-black/50 text-white hover:bg-black/70 p-2"
                  leftIcon={<ChevronRight className="w-6 h-6" />}
                />
              </div>
            )}
          </>
        )}

        {/* Current Image */}
        {images[selectedImageIndex] && (
          <div className="relative w-[90vw] h-[90vh] max-w-none flex items-center justify-center">
            <Image
              src={images[selectedImageIndex]}
              alt={`Screenshot ${selectedImageIndex + 1}`}
              fill
              className="object-contain"
              sizes="90vw"
              priority={true}
              unoptimized
              onError={(e) => {
                // Handle HEIC and other unsupported formats
                const target = e.target as HTMLImageElement;
                const imageUrl = images[selectedImageIndex];
                const isHeic = imageUrl.toLowerCase().match(/\.heic$/);

                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.image-error')) {
                  const errorDiv = document.createElement('div');
                  errorDiv.className = 'image-error flex flex-col items-center justify-center text-white text-center px-8';
                  errorDiv.innerHTML = `
                    <p class="text-xl mb-4">${isHeic ? 'HEIC format not supported in browser' : 'Failed to load image'}</p>
                    <a href="${imageUrl}" download class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded border border-white/20 transition-colors">
                      Download original file
                    </a>
                  `;
                  parent.appendChild(errorDiv);
                }
              }}
            />
          </div>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2 rounded-full bg-black/50 text-white text-sm">
            {selectedImageIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </Modal>
  );
}
