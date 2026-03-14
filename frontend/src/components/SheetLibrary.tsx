import { Button } from '@/components/ui/button';
import {
  deleteSheetById,
  fetchSheets,
  updateSheet,
  uploadSheetImage,
} from '@/lib/api';
import type { Sheet } from '@/lib/types';
import { ImagePlus, Music, Play, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

function formatDuration(seconds: number): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SheetLibraryProps {
  refreshKey?: number;
}

export function SheetLibrary({ refreshKey }: SheetLibraryProps) {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{
    id: number;
    field: 'name' | 'author';
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetIdRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSheets();
      setSheets(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const startEdit = (sheet: Sheet, field: 'name' | 'author') => {
    setEditingField({ id: sheet.id, field });
    setEditValue(
      field === 'name'
        ? sheet.name || sheet.filename
        : sheet.author || '',
    );
  };

  const saveEdit = async () => {
    if (!editingField) return;
    const { id, field } = editingField;
    try {
      await updateSheet(id, { [field]: editValue || undefined });
      setSheets(prev =>
        prev.map(s =>
          s.id === id ? { ...s, [field]: editValue || null } : s,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setEditingField(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditingField(null);
  };

  const handleImageClick = (sheetId: number) => {
    imageTargetIdRef.current = sheetId;
    imageInputRef.current?.click();
  };

  const handleImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    const sheetId = imageTargetIdRef.current;
    if (!file || !sheetId) return;
    e.target.value = '';
    try {
      const imageFilename = await uploadSheetImage(sheetId, file);
      setSheets(prev =>
        prev.map(s =>
          s.id === sheetId ? { ...s, image_filename: imageFilename } : s,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to upload image',
      );
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSheetById(id);
      setSheets(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (sheets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Music className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No sheets yet. Process one to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Library</h2>
        <span className="text-xs text-muted-foreground">
          {sheets.length} sheet{sheets.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sheets.map(sheet => (
          <div
            key={sheet.id}
            className="flex flex-col rounded-lg border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors"
          >
            {/* Image / placeholder */}
            <div className="relative h-28 bg-muted flex items-center justify-center group">
              {sheet.image_filename ? (
                <img
                  src={`/uploads/${sheet.image_filename}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="h-8 w-8 text-muted-foreground/40" />
              )}
              <button
                type="button"
                onClick={() => handleImageClick(sheet.id)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <ImagePlus className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Info */}
            <div className="p-3 flex flex-col gap-1 flex-1">
              {editingField?.id === sheet.id &&
              editingField.field === 'name' ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  className="text-sm font-medium bg-transparent border-b border-primary outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(sheet, 'name')}
                  className="text-sm font-medium truncate text-left hover:text-primary transition-colors cursor-text"
                  title="Click to edit name"
                >
                  {sheet.name || sheet.filename}
                </button>
              )}

              {editingField?.id === sheet.id &&
              editingField.field === 'author' ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  className="text-xs text-muted-foreground bg-transparent border-b border-primary outline-none"
                  placeholder="Author..."
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(sheet, 'author')}
                  className="text-xs text-muted-foreground truncate text-left hover:text-foreground transition-colors cursor-text"
                  title="Click to edit author"
                >
                  {sheet.author || 'Unknown author'}
                </button>
              )}

              <p className="text-xs text-muted-foreground mt-1">
                {sheet.note_count} notes
                {' \u00b7 '}
                {formatDuration(sheet.duration)}
                {' \u00b7 '}
                {new Date(sheet.created_at + 'Z').toLocaleDateString(
                  undefined,
                  { month: 'short', day: 'numeric' },
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 px-3 pb-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/player/${sheet.id}`)}
              >
                <Play className="h-4 w-4 mr-1" />
                Play
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive-foreground"
                onClick={() => handleDelete(sheet.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />

      {error && (
        <p className="mt-3 text-center text-sm text-destructive-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
