import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

export const auth = getAuth(initializeApp({
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
}))

// ponytail: unsigned upload only, backend stores secure_url
export async function uploadPhoto(file) {
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD
  const preset = import.meta.env.VITE_CLOUDINARY_PRESET
  if (!cloud || !preset || !file) return null
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', preset)
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd })
  const j = await r.json()
  return j.secure_url || null
}
