import { SheetLibrary } from '@/components/SheetLibrary';
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

          {/* Library section */}
          <section className="rounded-xl bg-[#181b2e] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">Your Library</h2>
            </div>
            <SheetLibrary />
          </section>
        </div>
      </div>
    </div>
  );
}
