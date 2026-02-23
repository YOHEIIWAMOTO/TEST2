import { useState } from 'react'

interface ImageViewerProps {
  src: string
  alt?: string
}

export default function ImageViewer({ src, alt = 'Receipt' }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-t-lg">
        <button
          onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
          className="px-2 py-1 bg-white rounded border text-sm hover:bg-gray-50"
        >-</button>
        <span className="text-sm text-gray-600 min-w-[4rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(z => Math.min(4, z + 0.25))}
          className="px-2 py-1 bg-white rounded border text-sm hover:bg-gray-50"
        >+</button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          onClick={() => setRotation(r => r - 90)}
          className="px-2 py-1 bg-white rounded border text-sm hover:bg-gray-50"
        >Rotate L</button>
        <button
          onClick={() => setRotation(r => r + 90)}
          className="px-2 py-1 bg-white rounded border text-sm hover:bg-gray-50"
        >Rotate R</button>
        <button
          onClick={() => { setZoom(1); setRotation(0) }}
          className="px-2 py-1 bg-white rounded border text-sm hover:bg-gray-50"
        >Reset</button>
      </div>

      <div className="flex-1 overflow-auto bg-gray-200 rounded-b-lg flex items-center justify-center min-h-[400px]">
        <img
          src={src}
          alt={alt}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
          }}
          className="max-w-none"
          draggable={false}
        />
      </div>
    </div>
  )
}
