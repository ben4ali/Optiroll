export interface NoteData {
  pitch: number;
  start: number;
  duration: number;
}

export type PlaybackState = 'idle' | 'playing' | 'paused';

export type InstrumentType = 'splendid' | 'electric' | 'soundfont' | 'mellotron';

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
      { label: 'Splendid Grand Piano', value: 'splendid_grand_piano', type: 'splendid' },
      { label: 'Acoustic Grand Piano', value: 'acoustic_grand_piano', type: 'soundfont', sfName: 'acoustic_grand_piano' },
      { label: 'Bright Acoustic Piano', value: 'bright_acoustic_piano', type: 'soundfont', sfName: 'bright_acoustic_piano' },
      { label: 'Honky-tonk Piano', value: 'honkytonk_piano', type: 'soundfont', sfName: 'honkytonk_piano' },
      { label: 'Electric Piano (CP80)', value: 'ep_cp80', type: 'electric', epName: 'CP80' },
      { label: 'Wurlitzer EP200', value: 'ep_wurlitzer', type: 'electric', epName: 'WurlitzerEP200' },
    ],
  },
  {
    label: 'Chromatic Percussion',
    instruments: [
      { label: 'Celesta', value: 'celesta', type: 'soundfont', sfName: 'celesta' },
      { label: 'Glockenspiel', value: 'glockenspiel', type: 'soundfont', sfName: 'glockenspiel' },
      { label: 'Music Box', value: 'music_box', type: 'soundfont', sfName: 'music_box' },
      { label: 'Vibraphone', value: 'vibraphone', type: 'soundfont', sfName: 'vibraphone' },
      { label: 'Marimba', value: 'marimba', type: 'soundfont', sfName: 'marimba' },
      { label: 'Xylophone', value: 'xylophone', type: 'soundfont', sfName: 'xylophone' },
    ],
  },
  {
    label: 'Organ',
    instruments: [
      { label: 'Church Organ', value: 'church_organ', type: 'soundfont', sfName: 'church_organ' },
      { label: 'Reed Organ', value: 'reed_organ', type: 'soundfont', sfName: 'reed_organ' },
    ],
  },
  {
    label: 'Strings',
    instruments: [
      { label: 'Violin', value: 'violin', type: 'soundfont', sfName: 'violin' },
      { label: 'Cello', value: 'cello', type: 'soundfont', sfName: 'cello' },
      { label: 'String Ensemble', value: 'string_ensemble_1', type: 'soundfont', sfName: 'string_ensemble_1' },
      { label: 'Orchestral Harp', value: 'orchestral_harp', type: 'soundfont', sfName: 'orchestral_harp' },
    ],
  },
  {
    label: 'Mellotron',
    instruments: [
      { label: 'Mellotron Strings', value: 'mello_violins', type: 'mellotron', mellotronName: 'MKII VIOLINS' },
      { label: 'Mellotron Flute', value: 'mello_flute', type: 'mellotron', mellotronName: 'TRON FLUTE' },
      { label: 'Mellotron Choir', value: 'mello_choir', type: 'mellotron', mellotronName: '8VOICE CHOIR' },
    ],
  },
  {
    label: 'Brass & Woodwinds',
    instruments: [
      { label: 'Trumpet', value: 'trumpet', type: 'soundfont', sfName: 'trumpet' },
      { label: 'French Horn', value: 'french_horn', type: 'soundfont', sfName: 'french_horn' },
      { label: 'Flute', value: 'flute', type: 'soundfont', sfName: 'flute' },
      { label: 'Clarinet', value: 'clarinet', type: 'soundfont', sfName: 'clarinet' },
      { label: 'Alto Sax', value: 'alto_sax', type: 'soundfont', sfName: 'alto_sax' },
    ],
  },
];

export const ALL_INSTRUMENTS: InstrumentOption[] =
  INSTRUMENT_CATEGORIES.flatMap(c => c.instruments);

export const DEFAULT_INSTRUMENT = 'splendid_grand_piano';

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
  note_count: number;
  created_at: string;
}
