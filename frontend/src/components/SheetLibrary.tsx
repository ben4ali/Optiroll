import { Button } from '@/components/ui/button';
import { useProcessing } from '@/contexts/ProcessingContext';
import {
  deleteSheetById,
  fetchSheets,
  updateSheet,
  uploadSheetImage,
} from '@/lib/api';
import type { Sheet } from '@/lib/types';
import gsap from 'gsap';
import { ImagePlus, Music, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

function formatDuration(seconds: number): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SheetLibrary() {
  const { status } = useProcessing();
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetIdRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
  }, [refresh]);

  // Auto-refresh when background processing completes
  useEffect(() => {
    if (status === 'done') {
      refresh();
    }
  }, [status, refresh]);

  // Animate rows in when sheets load
  useEffect(() => {
    if (listRef.current && sheets.length > 0) {
      const rows = listRef.current.children;
      gsap.fromTo(
        rows,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.04, ease: 'power3.out' },
      );
    }
  }, [sheets]);

  const startEdit = (sheet: Sheet) => {
    setEditingId(sheet.id);
    setEditName(sheet.name || sheet.filename);
    setEditAuthor(sheet.author || '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateSheet(editingId, {
        name: editName || undefined,
        author: editAuthor || undefined,
      });
      setSheets(prev =>
        prev.map(s =>
          s.id === editingId
            ? { ...s, name: editName || null, author: editAuthor || null }
            : s,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const handleImageClick = (sheetId: number) => {
    imageTargetIdRef.current = sheetId;
    imageInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setError(err instanceof Error ? err.message : 'Failed to upload image');
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
      <div className="flex flex-col items-center justify-center py-16 text-[#a1a1aa]">
        <Music className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No sheets yet. Upload one to get started.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Column header row */}
      <div className="flex items-center gap-4 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[#a1a1aa]/60 border-b border-white/5 mb-1">
        <span className="w-7 text-center">#</span>
        <span className="w-12" />
        <span className="flex-1">Title</span>
        <span className="w-20 text-right hidden sm:block">Notes</span>
        <span className="w-16 text-right hidden sm:block">Duration</span>
        <span className="w-24 text-right hidden md:block">Date</span>
        <span className="w-20" />
      </div>

      <div ref={listRef} className="flex flex-col gap-0.5">
        {sheets.map((sheet, index) => {
          const isEditing = editingId === sheet.id;

          return (
            <div
              key={sheet.id}
              className={`group flex items-center gap-4 px-4 py-2 rounded-md transition-colors ${
                isEditing
                  ? 'bg-[#1e2345]'
                  : 'hover:bg-white/[0.06] cursor-pointer'
              }`}
              onClick={() => {
                if (!isEditing) navigate(`/player/${sheet.id}`);
              }}
            >
              {/* Index number */}
              <span className="w-7 text-center text-sm tabular-nums text-[#a1a1aa]/50">
                {index + 1}
              </span>

              {/* Thumbnail */}
              <div className="relative w-12 h-12 rounded bg-[#1a1d35] flex items-center justify-center shrink-0 overflow-hidden">
                {sheet.image_filename ? (
                  <img
                    src={`/uploads/${sheet.image_filename}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="h-5 w-5 text-white/10" />
                )}
                {isEditing && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleImageClick(sheet.id);
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ImagePlus className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
              </div>

              {/* Title + Author */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex flex-col gap-1">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onClick={e => e.stopPropagation()}
                      className="text-sm font-medium bg-transparent border-b border-[#3b82f6]/50 outline-none text-white w-full"
                      placeholder="Title..."
                    />
                    <input
                      value={editAuthor}
                      onChange={e => setEditAuthor(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onClick={e => e.stopPropagation()}
                      className="text-xs bg-transparent border-b border-[#3b82f6]/30 outline-none text-[#a1a1aa] w-full"
                      placeholder="Author..."
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white truncate group-hover:text-white">
                      {sheet.name || sheet.filename}
                    </p>
                    <p className="text-xs text-[#a1a1aa] truncate">
                      {sheet.author || 'Unknown author'}
                    </p>
                  </>
                )}
              </div>

              {/* Notes count */}
              <span className="w-20 text-right text-xs text-[#a1a1aa] tabular-nums hidden sm:block">
                {sheet.note_count}
              </span>

              {/* Duration */}
              <span className="w-16 text-right text-xs text-[#a1a1aa] tabular-nums hidden sm:block">
                {formatDuration(sheet.duration)}
              </span>

              {/* Date */}
              <span className="w-24 text-right text-xs text-[#a1a1aa] hidden md:block">
                {new Date(sheet.created_at + 'Z').toLocaleDateString(
                  undefined,
                  { month: 'short', day: 'numeric', year: 'numeric' },
                )}
              </span>

              {/* Actions */}
              <div className="w-20 flex items-center justify-end gap-1">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs text-[#3b82f6] hover:text-white hover:bg-[#3b82f6]/20"
                      onClick={e => {
                        e.stopPropagation();
                        saveEdit();
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[#a1a1aa] hover:text-white hover:bg-white/[0.06]"
                      onClick={e => {
                        e.stopPropagation();
                        cancelEdit();
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#a1a1aa] hover:text-white hover:bg-white/[0.08]"
                      onClick={e => {
                        e.stopPropagation();
                        startEdit(sheet);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#a1a1aa] hover:text-red-400 hover:bg-white/[0.08]"
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(sheet.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
        <p className="mt-3 text-center text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
