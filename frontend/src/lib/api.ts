import type { NoteData, SSEEvent, Sheet, SheetDetail } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ---------------------------------------------------------------------------
// SSE streaming upload
// ---------------------------------------------------------------------------

export async function processSheetWithProgress(
  file: File,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<{ notes: NoteData[]; sheetId: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/process-sheet`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? 'Failed to process sheet music');
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let notes: NoteData[] = [];
  let sheetId = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop()!;

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      const data: SSEEvent = JSON.parse(line.slice(6));
      onEvent(data);
      if (data.type === 'done') {
        notes = data.notes;
        sheetId = data.sheetId;
      }
      if (data.type === 'error') {
        throw new Error(data.message);
      }
    }
  }

  return { notes, sheetId };
}

// ---------------------------------------------------------------------------
// Sheet library CRUD
// ---------------------------------------------------------------------------

export async function fetchSheets(): Promise<Sheet[]> {
  const res = await fetch(`${API_BASE}/sheets`);
  if (!res.ok) throw new Error('Failed to fetch sheets');
  return res.json();
}

export async function fetchSheet(sheetId: number): Promise<SheetDetail> {
  const res = await fetch(`${API_BASE}/sheets/${sheetId}`);
  if (!res.ok) throw new Error('Sheet not found');
  return res.json();
}

export async function deleteSheetById(sheetId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/sheets/${sheetId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete sheet');
}

export async function updateSheet(
  sheetId: number,
  data: { name?: string; author?: string },
): Promise<void> {
  const res = await fetch(`${API_BASE}/sheets/${sheetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update sheet');
}

export async function uploadSheetImage(
  sheetId: number,
  file: File,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/sheets/${sheetId}/image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload image');
  const data = await res.json();
  return data.image_filename;
}
