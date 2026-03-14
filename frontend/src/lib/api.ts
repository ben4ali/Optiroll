import type { NoteData, SSEEvent, Sheet } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ---------------------------------------------------------------------------
// SSE streaming upload
// ---------------------------------------------------------------------------

export async function processSheetWithProgress(
  file: File,
  onEvent: (event: SSEEvent) => void,
): Promise<NoteData[]> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/process-sheet`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? 'Failed to process sheet music');
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let notes: NoteData[] = [];

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
      }
      if (data.type === 'error') {
        throw new Error(data.message);
      }
    }
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Sheet library CRUD
// ---------------------------------------------------------------------------

export async function fetchSheets(): Promise<Sheet[]> {
  const res = await fetch(`${API_BASE}/sheets`);
  if (!res.ok) throw new Error('Failed to fetch sheets');
  return res.json();
}

export async function fetchSheetNotes(sheetId: number): Promise<NoteData[]> {
  const res = await fetch(`${API_BASE}/sheets/${sheetId}`);
  if (!res.ok) throw new Error('Sheet not found');
  return res.json();
}

export async function deleteSheetById(sheetId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/sheets/${sheetId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete sheet');
}
