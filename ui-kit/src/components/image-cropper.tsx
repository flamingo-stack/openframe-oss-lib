/*
  ImageCropper.tsx
  ----------------
  Reusable React component for interactive image cropping with:
    • Drag / resize cropping via react-easy-crop
    • Custom aspect ratio or free-form
    • Optional circular crop overlay (avatar mode)
    • Automatic scaling so the exported image never exceeds maxSizePx
    • Returns PNG data URL + Blob on confirm
    • Responsive / accessible with shadcn/ui Button & Slider components

  Styling relies on Tailwind + shadcn design tokens.
*/

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Cropper from "react-easy-crop"
import { Button } from "./ui/button"
import { Slider } from "./ui/slider"
import { cn } from "../utils/cn"
import { Check, RotateCcw } from "lucide-react"

/* ------------------------------------------------------------
 * Types
 * ----------------------------------------------------------*/

export interface ImageCropperResult {
  /** Cropped PNG data URL */
  dataUrl: string
  /** Corresponding PNG Blob */
  blob: Blob
}

export interface ImageCropperProps {
  /** Source image (URL or data URI) */
  src: string
  /** Called when user confirms crop */
  onComplete(result: ImageCropperResult): void
  /** Called when user cancels crop */
  onCancel?(): void
  /** Aspect ratio (width / height).  If omitted, free-form */
  aspectRatio?: number
  /** Enable circular crop overlay for avatars */
  circular?: boolean
  /** Maximum width/height for the exported PNG (defaults 512) */
  maxSizePx?: number
  /** Optional className for wrapper */
  className?: string
}

/* ------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------*/

function degToRad(deg: number) {
  return (deg * Math.PI) / 180
}

/** Util to create an HTMLImageElement that resolves when loaded */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous" // prevent canvas tainting
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = src
  })
}

/* ------------------------------------------------------------
 * Component
 * ----------------------------------------------------------*/

export const ImageCropper: React.FC<ImageCropperProps> = ({
  src,
  onComplete,
  onCancel,
  aspectRatio,
  circular = false,
  maxSizePx = 512,
  className,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<
    | { x: number; y: number; width: number; height: number }
    | null
  >(null)

  /* ------------------ crop complete callback -----------------*/
  const onCropComplete = useCallback((_: any, area: any) => {
    setCroppedAreaPixels(area)
  }, [])

  /* ------------------ Build checkered background --------------*/
  const checkerBg =
    "bg-[length:16px_16px] bg-[linear-gradient(45deg,transparent_25%,#2a2a2a_25%,#2a2a2a_75%,transparent_75%,transparent),linear-gradient(45deg,#2a2a2a_25%,transparent_25%,transparent_75%,#2a2a2a_75%,#2a2a2a)]"

  /* ------------------ Export logic ---------------------------*/
  const exportCrop = useCallback(async () => {
    if (!croppedAreaPixels) return undefined

    const img = await loadImage(src)

    // Create canvas the size of crop
    const canvas = document.createElement("canvas")

    // Scale crop to fit maxSizePx
    const scale = Math.min(1, maxSizePx / Math.max(croppedAreaPixels.width, croppedAreaPixels.height))
    const outputW = Math.round(croppedAreaPixels.width * scale)
    const outputH = Math.round(croppedAreaPixels.height * scale)

    canvas.width = outputW
    canvas.height = outputH
    const ctx = canvas.getContext("2d")!

    // Draw cropped portion
    ctx.drawImage(
      img,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      outputW,
      outputH,
    )

    // If circular mode, clip to circle
    if (circular) {
      const temp = document.createElement("canvas")
      temp.width = outputW
      temp.height = outputH
      const tctx = temp.getContext("2d")!
      tctx.beginPath()
      tctx.arc(outputW / 2, outputH / 2, outputW / 2, 0, Math.PI * 2)
      tctx.closePath()
      tctx.clip()
      tctx.drawImage(canvas, 0, 0)
      canvas.width = outputW
      canvas.height = outputH
      ctx.clearRect(0, 0, outputW, outputH)
      ctx.drawImage(temp, 0, 0)
    }

    return new Promise<ImageCropperResult>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) throw new Error("Canvas export failed")
          const reader = new FileReader()
          reader.onloadend = () => {
            resolve({ dataUrl: reader.result as string, blob })
          }
          reader.readAsDataURL(blob)
        },
        "image/png",
      )
    })
  }, [croppedAreaPixels, circular, maxSizePx, src]) as () => Promise<ImageCropperResult | undefined>

  /* ------------------ Keyboard accessibility -----------------*/
  const handleKey = (e: React.KeyboardEvent) => {
    // Enter to confirm, Esc to cancel
    if (e.key === "Enter") {
      e.preventDefault()
      void exportCrop().then((res) => {
        if (res) onComplete(res)
      })
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancel?.()
    }
  }

  /* ------------------ Render ---------------------------------*/
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 w-full",
        className,
      )}
      onKeyDown={handleKey}
      tabIndex={0}
      aria-label="Image cropper"
    >
      {/* Cropper container */}
      <div
        className={cn(
          "relative w-full aspect-square sm:aspect-video rounded-md overflow-hidden",
          checkerBg,
        )}
      >
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspectRatio}
          cropShape={circular ? "round" : "rect"}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          objectFit="contain"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        {/* Zoom */}
        <div className="flex items-center gap-3">
          <span className="min-w-[60px] text-sm">Zoom</span>
          <Slider
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            onValueChange={(v) => setZoom(v[0])}
            aria-label="Zoom"
            className="flex-1"
          />
        </div>
        {/* Rotate */}
        <div className="flex items-center gap-3">
          <span className="min-w-[60px] text-sm">Rotate</span>
          <Slider
            min={0}
            max={360}
            step={1}
            value={[rotation]}
            onValueChange={(v) => setRotation(v[0])}
            aria-label="Rotation"
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setRotation(0)}
            aria-label="Reset rotation"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 mt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} aria-label="Cancel crop">
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          onClick={async () => {
            const result = await exportCrop()
            if (result) onComplete(result)
          }}
          leftIcon={<Check className="h-4 w-4" />}
          aria-label="Apply crop"
        >
          Apply
        </Button>
      </div>
    </div>
  )
} 