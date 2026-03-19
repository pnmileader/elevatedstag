'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Camera, Upload, X, Loader2, Trash2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase'

type ClientPhoto = {
  id: string
  client_id: string
  photo_type: string
  image_url: string
  caption: string | null
  created_at: string
}

const PHOTO_TYPES = [
  { value: 'fitting_front', label: 'Fitting - Front' },
  { value: 'fitting_side', label: 'Fitting - Side' },
  { value: 'fitting_back', label: 'Fitting - Back' },
  { value: 'owned_item', label: 'Owned Item' },
  { value: 'ready_made', label: 'Ready-Made' },
]

export default function ClientPhotosGallery({ clientId }: { clientId: string }) {
  const [photos, setPhotos] = useState<ClientPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<ClientPhoto | null>(null)
  const [uploadType, setUploadType] = useState('fitting_front')
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    async function loadPhotos() {
      const supabase = createClient()
      const { data } = await supabase
        .from('client_photos')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      setPhotos(data || [])
      setLoading(false)
    }
    loadPhotos()
  }, [clientId])

  // Focus trap and Escape key handler for modal
  useEffect(() => {
    if (!selectedPhoto || !modalRef.current) return

    // Focus the close button when modal opens
    closeButtonRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedPhoto(null)
        setConfirmingDelete(false)
        return
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedPhoto])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)
    const supabase = createClient()

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${clientId}/${Date.now()}.${fileExt}`

      const { data: uploadData, error: storageError } = await supabase
        .storage
        .from('client-photos')
        .upload(fileName, file)

      if (storageError) {
        setUploadError('Failed to upload photo. Please check that storage is configured and try again.')
        setUploading(false)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('client-photos').getPublicUrl(fileName)

      const { data: photoData, error: insertError } = await supabase
        .from('client_photos')
        .insert({
          client_id: clientId,
          photo_type: uploadType,
          image_url: urlData.publicUrl,
          caption: uploadCaption || null,
        })
        .select()
        .single()

      if (!insertError && photoData) {
        setPhotos(prev => [photoData, ...prev])
      }
    } catch (err) {
      console.error('Upload error:', err)
      setUploadError('An unexpected error occurred during upload.')
    } finally {
      setUploading(false)
      setShowUpload(false)
      setUploadCaption('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(photoId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('client_photos')
      .delete()
      .eq('id', photoId)

    if (!error) {
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      setSelectedPhoto(null)
      setConfirmingDelete(false)
    }
  }

  const fittingPhotos = photos.filter(p => p.photo_type.startsWith('fitting_'))
  const itemPhotos = photos.filter(p => !p.photo_type.startsWith('fitting_'))

  return (
    <div className="bg-white rounded p-3 lg:p-3 border border-gray-med">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-sm font-medium text-body flex items-center gap-2">
          <Camera className="w-5 h-5 text-gold" />
          Client Photos
        </h2>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="text-gray-dark hover:text-body font-body text-sm font-medium flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Photo
        </button>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 font-body text-sm flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Form */}
      {showUpload && (
        <div className="mb-2 p-4 bg-gray-light rounded">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block font-body text-xs font-medium text-gray-dark mb-1">Type</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-gold bg-white"
              >
                {PHOTO_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-body text-xs font-medium text-gray-dark mb-1">Caption</label>
              <input
                type="text"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Optional caption..."
                className="w-full px-3 py-2 border border-gray-med rounded font-body text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-body text-white rounded font-body text-sm font-medium cursor-pointer hover:bg-body-hover transition-colors">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Choose Photo
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            <button
              onClick={() => setShowUpload(false)}
              className="px-4 py-2 border border-gray-med rounded font-body text-sm text-gray-dark hover:bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : photos.length === 0 ? (
        <p className="text-gray-dark font-body text-sm">No photos yet. Add fitting photos, owned items, or ready-made photos.</p>
      ) : (
        <div className="space-y-2">
          {/* Fitting Photos Row */}
          {fittingPhotos.length > 0 && (
            <div>
              <h3 className="font-body text-[11px] font-medium text-gray-dark uppercase tracking-[0.05em] mb-2">Fitting Photos</h3>
              <div className="grid grid-cols-3 gap-3">
                {fittingPhotos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="aspect-[3/4] rounded overflow-hidden border border-gray-med hover:border-gold transition-colors relative group"
                  >
                    <Image
                      src={photo.image_url}
                      alt={photo.caption || photo.photo_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      fill
                      sizes="(max-width: 768px) 33vw, 200px"
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white font-body text-[10px] font-medium">
                        {PHOTO_TYPES.find(t => t.value === photo.photo_type)?.label || photo.photo_type}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Item Photos Grid */}
          {itemPhotos.length > 0 && (
            <div>
              <h3 className="font-body text-[11px] font-medium text-gray-dark uppercase tracking-[0.05em] mb-2">Item Photos</h3>
              <div className="grid grid-cols-3 gap-3">
                {itemPhotos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="aspect-square rounded overflow-hidden border border-gray-med hover:border-gold transition-colors relative group"
                  >
                    <Image
                      src={photo.image_url}
                      alt={photo.caption || photo.photo_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      fill
                      sizes="(max-width: 768px) 33vw, 200px"
                      className="object-cover"
                      unoptimized
                    />
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <p className="text-white font-body text-[10px]">{photo.caption}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => { if (!confirmingDelete) setSelectedPhoto(null) }}
          role="dialog"
          aria-modal="true"
          aria-label="Photo detail"
        >
          <div
            ref={modalRef}
            className="bg-white rounded max-w-lg w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Image
                src={selectedPhoto.image_url}
                alt={selectedPhoto.caption || selectedPhoto.photo_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                width={800}
                height={600}
                className="w-full rounded-t-2xl"
                unoptimized
              />
              <button
                ref={closeButtonRef}
                onClick={() => { setSelectedPhoto(null); setConfirmingDelete(false) }}
                aria-label="Close photo detail"
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded flex items-center justify-center text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="px-3 py-1 bg-gray-light text-body rounded text-xs font-body font-medium">
                  {PHOTO_TYPES.find(t => t.value === selectedPhoto.photo_type)?.label || selectedPhoto.photo_type}
                </span>
                <span className="font-body text-xs text-gray-dark">
                  {new Date(selectedPhoto.created_at).toLocaleDateString()}
                </span>
              </div>
              {selectedPhoto.caption && (
                <p className="font-body text-sm mt-2">{selectedPhoto.caption}</p>
              )}
              {confirmingDelete ? (
                <div className="mt-4 flex items-center gap-3">
                  <span className="font-body text-sm text-red-600">Delete this photo?</span>
                  <button
                    onClick={() => handleDelete(selectedPhoto.id)}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded font-body text-sm transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="px-3 py-1 border border-gray-med rounded font-body text-sm text-gray-dark hover:bg-gray-light transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="mt-4 flex items-center gap-2 text-red-500 hover:text-red-700 font-body text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
