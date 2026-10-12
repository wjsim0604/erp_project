import path from 'node:path';

export const MAX_PROJECT_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const allowedDocumentTypes: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
};

export function projectDocumentPath(storageName: string) {
  if (!/^[0-9a-f-]{36}$/.test(storageName)) throw new Error('Invalid document storage key');
  const root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), '.private-uploads'));
  const filePath = path.resolve(root, storageName);
  const relativePath = path.relative(root, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) throw new Error('Invalid document path');
  return filePath;
}

export function safeOriginalName(rawName: string) {
  const baseName = rawName.replace(/\\/g, '/').split('/').pop() ?? 'file';
  const cleaned = baseName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'file').slice(0, 255);
}
