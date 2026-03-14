import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteSheetById, fetchSheetNotes, fetchSheets } from '@/lib/api';
import type { NoteData, Sheet } from '@/lib/types';
import { FolderOpen, Loader2, Music, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface SheetLibraryProps {
  onNotesLoaded: (notes: NoteData[]) => void;
}

export function SheetLibrary({ onNotesLoaded }: SheetLibraryProps) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSheets();
      setSheets(data);
    } catch {
      // silently ignore on initial load
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLoad = useCallback(
    async (sheet: Sheet) => {
      setError(null);
      setLoadingId(sheet.id);
      try {
        const notes = await fetchSheetNotes(sheet.id);
        onNotesLoaded(notes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sheet');
      } finally {
        setLoadingId(null);
      }
    },
    [onNotesLoaded],
  );

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteSheetById(id);
      setSheets(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, []);

  if (sheets.length === 0) return null;

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Library</CardTitle>
          <span className="text-xs text-muted-foreground ml-auto">
            {sheets.length} sheet{sheets.length !== 1 ? 's' : ''}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {sheets.map(sheet => (
            <div
              key={sheet.id}
              className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-accent/30 transition-colors"
            >
              <Music className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{sheet.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {sheet.note_count} notes &middot;{' '}
                  {new Date(sheet.created_at + 'Z').toLocaleDateString(
                    undefined,
                    {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={loadingId === sheet.id}
                onClick={() => handleLoad(sheet)}
              >
                {loadingId === sheet.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Load'
                )}
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
          ))}
        </div>
        {error && (
          <p className="mt-3 text-center text-sm text-destructive-foreground">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
