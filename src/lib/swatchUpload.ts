// Swatch photos: shrink + convert on the device, store in the existing `client-photos`
// bucket under swatches/<client>/<order>-<time>.jpg, then point the order at it.
import type { SupabaseClient } from '@supabase/supabase-js'

export const SWATCH_BUCKET = 'client-photos'
const MAX_EDGE = 1600
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const PASSTHROUGH_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function swatchPath(clientId: string, orderId: string, now = Date.now()): string {
  return `swatches/${clientId}/${orderId}-${now}.jpg`
}

/** The storage path for a URL we issued, so a replaced photo can be removed. Null for anything else. */
export function swatchPathFromUrl(url: string | null | undefined): string | null {
  const marker = `/object/public/${SWATCH_BUCKET}/`
  const i = url?.indexOf(marker) ?? -1
  if (!url || i < 0) return null
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0])
  return path.startsWith('swatches/') ? path : null
}

/** iPad photos can be large HEIC files; re-encode to a ~1600px JPEG every browser can show. */
async function toJpeg(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (blob) return blob
  } catch {
    // fall through to the original file
  }
  if (!PASSTHROUGH_TYPES.includes(file.type)) {
    throw new Error('That file type can’t be used. Please choose a JPEG, PNG, or WebP photo.')
  }
  return file
}

export async function uploadSwatch(
  supabase: SupabaseClient,
  opts: { file: File; clientId: string; orderId: string; previousUrl?: string | null },
): Promise<string> {
  if (!opts.file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(opts.file.name)) {
    throw new Error('Please choose a photo.')
  }
  const blob = await toJpeg(opts.file)
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('That photo is too large (10MB max).')

  const path = swatchPath(opts.clientId, opts.orderId)
  const { error: uploadError } = await supabase.storage
    .from(SWATCH_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
  if (uploadError) throw new Error('The photo didn’t upload. Check your connection and try again.')

  const url = supabase.storage.from(SWATCH_BUCKET).getPublicUrl(path).data.publicUrl
  const { error: updateError } = await supabase
    .from('custom_orders')
    .update({ swatch_image_url: url })
    .eq('id', opts.orderId)
  if (updateError) {
    await supabase.storage.from(SWATCH_BUCKET).remove([path])
    throw new Error('The photo uploaded but couldn’t be attached to the order. Please try again.')
  }

  const oldPath = swatchPathFromUrl(opts.previousUrl)
  if (oldPath) await supabase.storage.from(SWATCH_BUCKET).remove([oldPath]) // best effort

  return url
}
