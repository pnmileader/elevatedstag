'use client'

import { useState, useEffect, useRef } from 'react'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const supabase = createClient()

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${clientId}/${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('client-photos')
        .upload(fileName, file)

      if (uploadError) {
        // If bucket doesn't exist, store as data URL fallback
        const reader = new FileReader()
        reader.onloadend = async () => {
          const dataUrl = reader.result as string
          const { data: photoData, error: insertError } = await supabase
            .from('client_photos')
            .insert({
              client_id: clientId,
              photo_type: uploadType,
              image_url: dataUrl,
              caption: uploadCaption || null,
            })
            .select()
            .single()

          if (!insertError && photoData) {
            setPhotos(prev => [photoData, ...prev])
          }
          setUploading(false)
          setShowUpload(false)
          setUploadCaption('')
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
        reader.readAsDataURL(file)
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
    } finally {
      setUploading(false)
      setShowUpload(false)
      setUploadCaption('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Delete this photo?')) return

    const supabase = createClient()
    const { error } = await supabase
      .from('client_photos')
      .delete()
      .eq('id', photoId)

    if (!error) {
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      setSelectedPhoto(null)
    }
  }

  const fittingPhotos = photos.filter(p => p.photo_type.startsWith('fitting_'))
  const itemPhotos = photos.filter(p => !p.photo_type.startsWith('fitting_'))

  return (
    <div className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-med" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-sm font-medium text-[#2D2D2D] flex items-center gap-2">
          <Camera className="w-5 h-5 text-gold" />
          Client Photos
        </h2>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="text-[#8A8A8A] hover:text-[#2D2D2D] font-body text-sm font-medium flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Photo
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="mb-5 p-4 bg-gray-light rounded-lg">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block font-body text-xs font-medium text-gray-dark mb-1">Type</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-med rounded-lg font-body text-sm focus:outline-none focus:border-gold bg-white"
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
                className="w-full px-3 py-2 border border-gray-med rounded-lg font-body text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2D2D2D] text-white rounded-xl font-body text-sm font-medium cursor-pointer hover:bg-[#404040] transition-colors">
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
              className="px-4 py-2 border border-gray-med rounded-lg font-body text-sm text-gray-dark hover:bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : photos.length === 0 ? (
        <p className="text-gray-dark font-body text-sm">No photos yet. Add fitting photos, owned items, or ready-made photos.</p>
      ) : (
        <div className="space-y-5">
          {/* Fitting Photos Row */}
          {fittingPhotos.length > 0 && (
            <div>
              <h3 className="font-body text-[11px] font-medium text-[#8A8A8A] uppercase tracking-[0.05em] mb-2">Fitting Photos</h3>
              <div className="grid grid-cols-3 gap-3">
                {fittingPhotos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="aspect-[3/4] rounded-lg overflow-hidden border border-gray-med hover:border-gold transition-colors relative group"
                  >
                    <img
                      src={photo.image_url}
                      alt={photo.caption || photo.photo_type}
                      className="w-full h-full object-cover"
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
              <h3 className="font-body text-[11px] font-medium text-[#8A8A8A] uppercase tracking-[0.05em] mb-2">Item Photos</h3>
              <div className="grid grid-cols-3 gap-3">
                {itemPhotos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="aspect-square rounded-lg overflow-hidden border border-gray-med hover:border-gold transition-colors relative group"
                  >
                    <img
                      src={photo.image_url}
                      alt={photo.caption || photo.photo_type}
                      className="w-full h-full object-cover"
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
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={selectedPhoto.image_url}
                alt={selectedPhoto.caption || ''}
                className="w-full rounded-t-2xl"
              />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="px-3 py-1 bg-gray-light text-[#2D2D2D] rounded-full text-xs font-body font-medium">
                  {PHOTO_TYPES.find(t => t.value === selectedPhoto.photo_type)?.label || selectedPhoto.photo_type}
                </span>
                <span className="font-body text-xs text-gray-dark">
                  {new Date(selectedPhoto.created_at).toLocaleDateString()}
                </span>
              </div>
              {selectedPhoto.caption && (
                <p className="font-body text-sm mt-2">{selectedPhoto.caption}</p>
              )}
              <button
                onClick={() => handleDelete(selectedPhoto.id)}
                className="mt-4 flex items-center gap-2 text-red-500 hover:text-red-700 font-body text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
