import { supabase } from '@/lib/supabase';

const BUCKET = 'school-assets';

/**
 * Upload a school logo to Supabase Storage.
 * Files are stored under `{schoolId}/logo.{ext}` so each school
 * only ever has one logo file (overwritten on re-upload).
 */
export async function uploadSchoolLogo(schoolId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  if (!allowedExts.includes(ext)) {
    throw new Error(`Invalid file type ".${ext}". Allowed: ${allowedExts.join(', ')}`);
  }

  // Max 2 MB
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 2 MB.');
  }

  const path = `${schoolId}/logo.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true, // overwrite previous logo
    contentType: file.type,
  });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Append cache-buster so browsers pick up new uploads immediately
  return `${urlData.publicUrl}?t=${Date.now()}`;
}

/**
 * Upload a school site image (hero, building, gallery, principal photo, etc.)
 * Files are stored under `{schoolId}/site/{category}/{timestamp}.{ext}`.
 */
export async function uploadSchoolSiteImage(
  schoolId: string,
  file: File,
  category: 'hero' | 'building' | 'gallery' | 'principal' | 'auth-bg' | 'staff' | 'slide',
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  if (!allowedExts.includes(ext)) {
    throw new Error(`Invalid file type ".${ext}". Allowed: ${allowedExts.join(', ')}`);
  }

  // Max 5 MB for site images
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 5 MB.');
  }

  const uniqueName =
    category === 'gallery' || category === 'staff' || category === 'slide'
      ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      : `${category}.${ext}`;

  const path = `${schoolId}/site/${category}/${uniqueName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return `${urlData.publicUrl}?t=${Date.now()}`;
}
