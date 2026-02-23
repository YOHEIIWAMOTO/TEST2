import { useState, useRef, DragEvent, ChangeEvent } from 'react'

interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>
  disabled?: boolean
}

export default function FileUpload({ onUpload, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    )
    if (files.length > 0) {
      setIsUploading(true)
      try { await onUpload(files) } finally { setIsUploading(false) }
    }
  }

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setIsUploading(true)
      try { await onUpload(files) } finally { setIsUploading(false) }
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        ${(disabled || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled || isUploading}
      />
      <p className="text-gray-600">
        {isUploading ? 'Uploading...' : 'Drop receipt images here or click to select'}
      </p>
    </div>
  )
}
