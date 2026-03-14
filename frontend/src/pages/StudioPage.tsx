import { SheetLibrary } from '@/components/SheetLibrary';
import { SheetUpload } from '@/components/SheetUpload';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

export function StudioPage() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProcessed = useCallback(
    (sheetId: number) => {
      setRefreshKey(k => k + 1);
      navigate(`/player/${sheetId}`);
    },
    [navigate],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-8">
          {/* Left: Upload */}
          <div>
            <SheetUpload onProcessed={handleProcessed} />
          </div>

          {/* Right: Library */}
          <div>
            <SheetLibrary refreshKey={refreshKey} />
          </div>
        </div>
      </div>
    </div>
  );
}
