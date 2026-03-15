import LightRays from '@/components/LightRays';
import ParticleText from '@/components/particle-text';
import { fetchSheets } from '@/lib/api';
import type { Sheet } from '@/lib/types';
import gsap from 'gsap';
import { ArrowRight, Cpu, Music, Play, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

const steps = [
  {
    icon: Upload,
    title: 'Upload',
    description:
      'Upload an image or PDF of standard sheet music. It supports PNG, JPG, TIFF, and multi-page PDF files.',
  },
  {
    icon: Cpu,
    title: 'Process',
    description:
      'The Optical Music Recognition (OMR) AI scans and translates every note, rest, and dynamic marking.',
  },
  {
    icon: Play,
    title: 'Play',
    description:
      'Interact with the generated falling-bars piano roll. Control the tempo, change instruments, and add effects.',
  },
];

export function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);

  // Fetch sheets for carousel
  useEffect(() => {
    fetchSheets()
      .then(setSheets)
      .catch(() => {});
  }, []);

  // CSS-free infinite scroll via rAF + translateX
  useEffect(() => {
    if (sheets.length === 0) return;
    const speed = 0.3; // px per frame

    const tick = () => {
      if (!pausedRef.current) {
        offsetRef.current -= speed;
        // Each item is 160px + 12px padding + 20px gap = 192px. Reset after one full set.
        const singleSetWidth = sheets.length * 192;
        if (Math.abs(offsetRef.current) >= singleSetWidth) {
          offsetRef.current += singleSetWidth;
        }
      }
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${offsetRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [sheets]);

  const handleCarouselClick = useCallback(
    (id: number) => {
      navigate(`/player/${id}`);
    },
    [navigate],
  );

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    if (heroRef.current) {
      const children = heroRef.current.children;
      tl.fromTo(
        children,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.15 },
      );
    }
    if (cardsRef.current) {
      const cards = cardsRef.current.children;
      tl.fromTo(
        cards,
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 },
        '-=0.3',
      );
    }
  }, []);

  return (
    <div className="flex h-screen justify-between w-[90%] mx-auto items-center  relative">
      {/* Light rays background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-[#3b82f6]/[0.12] blur-[120px] pointer-events-none" />
      <div className="fixed inset-0 z-0 pointer-events-none">
        <LightRays raysColor="rgb(210,210,255)" className="opacity-40" />
      </div>
      {/* Soft blue glow behind title */}

      {/* Hero Section */}
      <section className="relative z-10 h-screen flex flex-col items-center  px-6 pt-24 pb-20">
        <div
          ref={heroRef}
          className="relative z-10 flex flex-col text-start w-180 h-full"
        >
          <div className="  flex flex-col w-full">
            <span className="text-[3rem] transform translate-y-19">Genie</span>
          </div>
          <ParticleText
            text="Optiroll"
            colors={['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb']}
            particleSize={2}
            particleGap={2}
            mouseControls={{
              enabled: true,
              radius: 40,
              strength: 5,
            }}
            backgroundColor="transparent"
            fontFamily="sans-serif"
            fontSize={200}
            fontWeight="bold"
            friction={0.75}
            ease={0.05}
            autoFit={true}
            className="absolute bottom-25 -left-12 h-[25rem] w-[40rem]"
          />
          <div className=" absolute bottom-70">
            <p className="text-lg text-[#a1a1aa] font-normal leading-relaxed max-w-100">
              Turn sheet music into a playable, interactive piano roll using
              computer vision.
            </p>
          </div>
          <Link
            to="/studio"
            className="absolute bottom-55 inline-flex items-center gap-2 rounded-full bg-transparent text-neutral-200 border-neutral-500 border px-8 py-3 text-sm font-semibold  hover:scale-105 hover:bg-white/90 w-fit hover:text-black transition-all"
          >
            Start Now
            <ArrowRight className="h-4 w-4" />
          </Link>

          {/* Infinite carousel */}
          {sheets.length > 0 && (
            <div
              className="absolute bottom-25 left-3 w-[40rem] mx-auto overflow-hidden"
              onMouseEnter={() => {
                pausedRef.current = true;
              }}
              onMouseLeave={() => {
                pausedRef.current = false;
              }}
            >
              {/* Fade edges */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-[#0f1225] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-[#0f1225] to-transparent" />

              <div
                ref={trackRef}
                className="flex gap-5 will-change-transform"
                style={{ width: 'max-content' }}
              >
                {/* Render 3 copies for seamless loop */}
                {[...sheets, ...sheets, ...sheets].map((sheet, i) => (
                  <button
                    key={`${sheet.id}-${i}`}
                    type="button"
                    onClick={() => handleCarouselClick(sheet.id)}
                    className="relative shrink-0 group cursor-pointer p-1.5"
                  >
                    <div className="relative w-40 h-24 rounded-lg overflow-hidden">
                    {sheet.image_filename ? (
                      <img
                        src={`/uploads/${sheet.image_filename}`}
                        alt={sheet.name || sheet.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1a1d35] flex items-center justify-center">
                        <Music className="h-6 w-6 text-white/10" />
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center px-2">
                      <span className="text-xs font-medium text-white text-center truncate">
                        {sheet.name || sheet.filename}
                      </span>
                    </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Process Section */}
      <section className="relative w-1/2 z-10 px-6 pb-24">
        <div className="max-w-md mx-auto">
          <h2 className="text-sm font-semibold tracking-wide text-[#a1a1aa] uppercase text-start mb-10">
            How it works
          </h2>

          <div ref={cardsRef} className="relative flex flex-col gap-0">
            {/* Vertical connecting line */}
            <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-neutral-300/40 via-neutral-300/20 to-neutral-300/40" />

            {steps.map((step, i) => (
              <div
                key={step.title}
                className="group relative flex items-start gap-5 py-5"
              >
                {/* Step node */}
                <div className="relative z-10 shrink-0">
                  <div className="absolute -inset-2 rounded-full bg-[#3b82f6]/10 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300" />
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300/30 bg-[#141735] group-hover:border-neutral-300/60 group-hover:bg-[#1a1f42] transition-all duration-300">
                    <step.icon className="h-4.5 w-4.5 text-neutral-300 group-hover:text-neutral-100 transition-colors duration-300" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pt-1.5">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-[10px] font-mono font-semibold text-neutral-300/50 tracking-wider">
                      STEP {i + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1 group-hover:text-[#e2e8f0] transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
