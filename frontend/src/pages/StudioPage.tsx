import { SheetUpload } from '@/components/SheetUpload';
import gsap from 'gsap';
import { useEffect, useRef } from 'react';

export function StudioPage() {
  const headerRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    if (headerRef.current) {
      tl.fromTo(
        headerRef.current,
        { y: -10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4 },
      );
    }
    if (contentRef.current) {
      tl.fromTo(
        contentRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5 },
        '-=0.2',
      );
    }
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 ref={headerRef} className="text-4xl font-light text-white mb-8">
          Studio
        </h1>

        <div ref={contentRef} className="flex flex-col gap-6">
          {/* Upload section */}
          <SheetUpload />

          {/* OMR explanation */}
          <section className="rounded-xl  p-5">
            <h2 className="text-lg font-medium text-white mb-2">
              How Optical Music Recognition Works
            </h2>
            <div className="text-sm text-[#a1a1aa] leading-relaxed space-y-3">
              <p>
                OMR converts scanned sheet music into playable data in a few
                steps. First, pages are normalized: the upload is resized to a
                safe pixel budget and PDF pages are rendered at your chosen DPI.
                This preserves detail while keeping GPU/CPU memory stable.
              </p>
              <p>
                The model then detects staff lines, symbols, and note groups. It
                separates layered markings, extracts rhythmic structure, and
                reconstructs musical timing. These passes are combined into a
                MusicXML representation that captures pitch, duration, and
                expression.
              </p>
              <p>
                Finally, the MusicXML is translated into note events for the
                piano roll. The processing settings above let you trade speed
                for precision: higher DPI and pixel budgets reveal fine detail,
                while larger batch sizes favor throughput.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
