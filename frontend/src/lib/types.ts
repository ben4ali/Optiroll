export interface NoteData {
  pitch: number;
  start: number;
  duration: number;
}

export type ProcessingPreset = 'fast' | 'balanced' | 'accuracy';

export interface ProcessingSettings {
  preset: ProcessingPreset;
  pdfRenderDpi: number;
  pdfMinDpi: number;
  maxImagePixels: number;
  inferenceBatchSize: number;
}

export type PlaybackState = 'idle' | 'playing' | 'paused';

export type InstrumentType =
  | 'splendid'
  | 'electric'
  | 'soundfont'
  | 'mellotron';

export interface InstrumentOption {
  label: string;
  value: string;
  type: InstrumentType;
  sfName?: string;
  epName?: string;
  mellotronName?: string;
}

export const INSTRUMENT_CATEGORIES: {
  label: string;
  instruments: InstrumentOption[];
}[] = [
  {
    label: 'Piano',
    instruments: [
      {
        label: 'Splendid Grand Piano',
        value: 'splendid_grand_piano',
        type: 'splendid',
      },
      {
        label: 'Acoustic Grand Piano',
        value: 'acoustic_grand_piano',
        type: 'soundfont',
        sfName: 'acoustic_grand_piano',
      },
      {
        label: 'Bright Acoustic Piano',
        value: 'bright_acoustic_piano',
        type: 'soundfont',
        sfName: 'bright_acoustic_piano',
      },
      {
        label: 'Honky-tonk Piano',
        value: 'honkytonk_piano',
        type: 'soundfont',
        sfName: 'honkytonk_piano',
      },
      {
        label: 'Clavinet',
        value: 'clavinet',
        type: 'soundfont',
        sfName: 'clavinet',
      },
      {
        label: 'Harpsichord',
        value: 'harpsichord',
        type: 'soundfont',
        sfName: 'harpsichord',
      },
      {
        label: 'Electric Piano (CP80)',
        value: 'ep_cp80',
        type: 'electric',
        epName: 'CP80',
      },
      {
        label: 'Wurlitzer EP200',
        value: 'ep_wurlitzer',
        type: 'electric',
        epName: 'WurlitzerEP200',
      },
      {
        label: 'Electric Piano 1',
        value: 'electric_piano_1',
        type: 'soundfont',
        sfName: 'electric_piano_1',
      },
      {
        label: 'Electric Piano 2',
        value: 'electric_piano_2',
        type: 'soundfont',
        sfName: 'electric_piano_2',
      },
    ],
  },
  {
    label: 'Guitar',
    instruments: [
      {
        label: 'Acoustic Nylon',
        value: 'acoustic_guitar_nylon',
        type: 'soundfont',
        sfName: 'acoustic_guitar_nylon',
      },
      {
        label: 'Acoustic Steel',
        value: 'acoustic_guitar_steel',
        type: 'soundfont',
        sfName: 'acoustic_guitar_steel',
      },
      {
        label: 'Electric Clean',
        value: 'electric_guitar_clean',
        type: 'soundfont',
        sfName: 'electric_guitar_clean',
      },
      {
        label: 'Electric Jazz',
        value: 'electric_guitar_jazz',
        type: 'soundfont',
        sfName: 'electric_guitar_jazz',
      },
    ],
  },
  {
    label: 'Chromatic Percussion',
    instruments: [
      {
        label: 'Celesta',
        value: 'celesta',
        type: 'soundfont',
        sfName: 'celesta',
      },
      {
        label: 'Glockenspiel',
        value: 'glockenspiel',
        type: 'soundfont',
        sfName: 'glockenspiel',
      },
      {
        label: 'Music Box',
        value: 'music_box',
        type: 'soundfont',
        sfName: 'music_box',
      },
      {
        label: 'Vibraphone',
        value: 'vibraphone',
        type: 'soundfont',
        sfName: 'vibraphone',
      },
      {
        label: 'Marimba',
        value: 'marimba',
        type: 'soundfont',
        sfName: 'marimba',
      },
      {
        label: 'Xylophone',
        value: 'xylophone',
        type: 'soundfont',
        sfName: 'xylophone',
      },
      {
        label: 'Kalimba',
        value: 'kalimba',
        type: 'soundfont',
        sfName: 'kalimba',
      },
      {
        label: 'Dulcimer',
        value: 'dulcimer',
        type: 'soundfont',
        sfName: 'dulcimer',
      },
    ],
  },
  {
    label: 'Organ',
    instruments: [
      {
        label: 'Church Organ',
        value: 'church_organ',
        type: 'soundfont',
        sfName: 'church_organ',
      },
      {
        label: 'Reed Organ',
        value: 'reed_organ',
        type: 'soundfont',
        sfName: 'reed_organ',
      },
    ],
  },
  {
    label: 'Strings',
    instruments: [
      { label: 'Violin', value: 'violin', type: 'soundfont', sfName: 'violin' },
      { label: 'Viola', value: 'viola', type: 'soundfont', sfName: 'viola' },
      { label: 'Cello', value: 'cello', type: 'soundfont', sfName: 'cello' },
      {
        label: 'Contrabass',
        value: 'contrabass',
        type: 'soundfont',
        sfName: 'contrabass',
      },
      {
        label: 'String Ensemble',
        value: 'string_ensemble_1',
        type: 'soundfont',
        sfName: 'string_ensemble_1',
      },
      {
        label: 'Pizzicato Strings',
        value: 'pizzicato_strings',
        type: 'soundfont',
        sfName: 'pizzicato_strings',
      },
      {
        label: 'Tremolo Strings',
        value: 'tremolo_strings',
        type: 'soundfont',
        sfName: 'tremolo_strings',
      },
      {
        label: 'Orchestral Harp',
        value: 'orchestral_harp',
        type: 'soundfont',
        sfName: 'orchestral_harp',
      },
    ],
  },
  {
    label: 'Synth',
    instruments: [
      {
        label: 'Pad Warm',
        value: 'pad_2_warm',
        type: 'soundfont',
        sfName: 'pad_2_warm',
      },
      {
        label: 'Pad Choir',
        value: 'pad_4_choir',
        type: 'soundfont',
        sfName: 'pad_4_choir',
      },
      {
        label: 'Lead Square',
        value: 'lead_1_square',
        type: 'soundfont',
        sfName: 'lead_1_square',
      },
      {
        label: 'Lead Sawtooth',
        value: 'lead_2_sawtooth',
        type: 'soundfont',
        sfName: 'lead_2_sawtooth',
      },
      {
        label: 'Synth Strings',
        value: 'synth_strings_1',
        type: 'soundfont',
        sfName: 'synth_strings_1',
      },
    ],
  },
  {
    label: 'Mellotron',
    instruments: [
      {
        label: 'Mellotron Strings',
        value: 'mello_violins',
        type: 'mellotron',
        mellotronName: 'MKII VIOLINS',
      },
      {
        label: 'Mellotron Flute',
        value: 'mello_flute',
        type: 'mellotron',
        mellotronName: 'TRON FLUTE',
      },
      {
        label: 'Mellotron Choir',
        value: 'mello_choir',
        type: 'mellotron',
        mellotronName: '8VOICE CHOIR',
      },
    ],
  },
  {
    label: 'Choir / Voice',
    instruments: [
      {
        label: 'Choir Aahs',
        value: 'choir_aahs',
        type: 'soundfont',
        sfName: 'choir_aahs',
      },
      {
        label: 'Voice Oohs',
        value: 'voice_oohs',
        type: 'soundfont',
        sfName: 'voice_oohs',
      },
      {
        label: 'Synth Voice',
        value: 'synth_voice',
        type: 'soundfont',
        sfName: 'synth_voice',
      },
      {
        label: 'Pad Choir',
        value: 'pad_4_choir_2',
        type: 'soundfont',
        sfName: 'pad_4_choir',
      },
      {
        label: 'Mellotron 8-Voice Choir',
        value: 'mello_choir_2',
        type: 'mellotron',
        mellotronName: '8VOICE CHOIR',
      },
      {
        label: 'Mellotron MK2 Brass',
        value: 'mello_brass',
        type: 'mellotron',
        mellotronName: 'MKII BRASS',
      },
    ],
  },
  {
    label: 'Brass',
    instruments: [
      {
        label: 'Trumpet',
        value: 'trumpet',
        type: 'soundfont',
        sfName: 'trumpet',
      },
      {
        label: 'Trombone',
        value: 'trombone',
        type: 'soundfont',
        sfName: 'trombone',
      },
      {
        label: 'French Horn',
        value: 'french_horn',
        type: 'soundfont',
        sfName: 'french_horn',
      },
      { label: 'Tuba', value: 'tuba', type: 'soundfont', sfName: 'tuba' },
      {
        label: 'Brass Section',
        value: 'brass_section',
        type: 'soundfont',
        sfName: 'brass_section',
      },
    ],
  },
  {
    label: 'Woodwinds',
    instruments: [
      { label: 'Flute', value: 'flute', type: 'soundfont', sfName: 'flute' },
      {
        label: 'Piccolo',
        value: 'piccolo',
        type: 'soundfont',
        sfName: 'piccolo',
      },
      {
        label: 'Clarinet',
        value: 'clarinet',
        type: 'soundfont',
        sfName: 'clarinet',
      },
      { label: 'Oboe', value: 'oboe', type: 'soundfont', sfName: 'oboe' },
      {
        label: 'Bassoon',
        value: 'bassoon',
        type: 'soundfont',
        sfName: 'bassoon',
      },
      {
        label: 'Alto Sax',
        value: 'alto_sax',
        type: 'soundfont',
        sfName: 'alto_sax',
      },
      {
        label: 'Soprano Sax',
        value: 'soprano_sax',
        type: 'soundfont',
        sfName: 'soprano_sax',
      },
      {
        label: 'Tenor Sax',
        value: 'tenor_sax',
        type: 'soundfont',
        sfName: 'tenor_sax',
      },
    ],
  },
];

export const ALL_INSTRUMENTS: InstrumentOption[] =
  INSTRUMENT_CATEGORIES.flatMap(c => c.instruments);

export const DEFAULT_INSTRUMENT = 'splendid_grand_piano';

// Hit effect types for piano roll
export type HitEffect = 'particles' | 'ripple' | 'glow' | 'none';

// WebGL hit effect types (particle systems)
export type WebGLHitEffect =
  | 'nebula'
  | 'shockwave'
  | 'spark'
  | 'stardust'
  | 'nova'
  | 'rift';

// WebGL visual settings
export interface WebGLVisualSettings {
  bloomStrength: number; // 0.0 - 3.0
  bloomRadius: number; // 0.0 - 1.0
  studioDarkness: number; // 0.0 (pitch black) - 1.0 (dim gray)
  hitEffect: WebGLHitEffect;
}

// SSE streaming events from backend
export interface SSELogEvent {
  type: 'log';
  message: string;
  progress: number;
}

export interface SSEDoneEvent {
  type: 'done';
  notes: NoteData[];
  sheetId: number;
  progress: number;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
  progress: number;
}

export type SSEEvent = SSELogEvent | SSEDoneEvent | SSEErrorEvent;

// Sheet library
export interface Sheet {
  id: number;
  filename: string;
  name: string | null;
  author: string | null;
  image_filename: string | null;
  note_count: number;
  duration: number;
  created_at: string;
}

// Full sheet data (with notes) from GET /sheets/:id
export interface SheetDetail extends Sheet {
  notes: NoteData[];
}
