import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchSheets } from '@/lib/api';
import type { Sheet } from '@/lib/types';
import { Library, Music, Play, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

function formatDuration(seconds: number): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function DashboardPage() {
  const [recent, setRecent] = useState<Sheet[]>([]);

  useEffect(() => {
    fetchSheets()
      .then(sheets => setRecent(sheets.slice(0, 5)))
      .catch(() => {});
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Music className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Piano Vision
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Upload sheet music images, convert them into interactive piano
            rolls, and play them back with customizable instruments and visual
            effects.
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <Link to="/studio" className="block">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Process New Sheet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload and convert sheet music
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/studio" className="block">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Library className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Browse Library</p>
                  <p className="text-sm text-muted-foreground">
                    View and manage your sheet collection
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent sheets */}
        {recent.length > 0 && (
          <div>
            <CardHeader className="px-0">
              <CardTitle className="text-lg">Recent Sheets</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2">
              {recent.map(sheet => (
                <Link
                  key={sheet.id}
                  to={`/player/${sheet.id}`}
                  className="block"
                >
                  <div className="flex items-center gap-4 rounded-lg border border-border p-4 hover:bg-accent/30 transition-colors">
                    {sheet.image_filename ? (
                      <img
                        src={`/uploads/${sheet.image_filename}`}
                        alt=""
                        className="h-10 w-10 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted shrink-0">
                        <Music className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {sheet.name || sheet.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sheet.note_count} notes
                        {' \u00b7 '}
                        {formatDuration(sheet.duration)}
                        {sheet.author && ` \u00b7 ${sheet.author}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <span>
                        <Play className="h-4 w-4 mr-1" />
                        Play
                      </span>
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
