import { SheetLibrary } from '@/components/SheetLibrary';
import gsap from 'gsap';
import { useEffect, useRef } from 'react';

export function LibraryPage() {
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    if (headerRef.current) {
      tl.fromTo(
        headerRef.current,
        { y: -12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45 },
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
          Library
        </h1>
        <section ref={contentRef} className="rounded-xl bg-[#181b2e] p-5 ">
          <SheetLibrary />
        </section>
      </div>
    </div>
  );
}
