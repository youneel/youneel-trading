export type GiveawayTemplateId =
  | 'premium_dark'
  | 'luxury_gold'
  | 'minimal_bw'
  | 'neon_trading'
  | 'modern_gradient'
  | 'special_event'
  | 'custom';

export type GiveawayFontId =
  | 'sans_modern'
  | 'editorial_serif'
  | 'condensed_display'
  | 'arabic_ibm';

export interface GiveawayStyleConfig {
  bgColor: string;
  surfaceColor: string;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  borderRadius: 'md' | 'xl' | '2xl' | '3xl';
  fontPreset: GiveawayFontId;
}

export interface ImageCropConfig {
  x: number;
  y: number;
  zoom: number;
  aspect: '16:9' | '4:3' | '1:1';
}

export interface GiveawayParticipant {
  id: string;
  giveaway_id: string;
  user_id: string;
  user_email: string;
  display_name: string;
  entry_note: string;
  status: 'pending' | 'approved' | 'rejected' | 'winner';
  submitted_at: string;
}

export interface GiveawayItem {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  prize: string;
  rules: string;
  sponsor?: string;
  eligibility_rules?: string;
  country_restrictions?: string;
  max_participants?: number | null;
  participantCount?: number;
  image_url: string;
  image_crop?: ImageCropConfig;
  external_url?: string;
  cta_label?: string;
  design_template?: GiveawayTemplateId;
  style_config?: Partial<GiveawayStyleConfig>;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended' | 'completed' | 'archived';
  is_published: boolean;
  is_archived?: boolean;
  publish_at?: string | null;
  starts_at: string;
  ends_at: string;
  winner_participant_id?: string | null;
  winner_display_name?: string | null;
  winner_announced_at?: string | null;
  myEntry?: GiveawayParticipant | null;
  participants?: GiveawayParticipant[];
}

export interface GiveawayTemplatePreset {
  id: GiveawayTemplateId;
  nameEn: string;
  nameAr: string;
  style: GiveawayStyleConfig;
  gradientBackdrop?: string;
}

export const GIVEAWAY_TEMPLATES: Record<GiveawayTemplateId, GiveawayTemplatePreset> = {
  premium_dark: {
    id: 'premium_dark',
    nameEn: 'Premium Dark',
    nameAr: 'داكن فاخر',
    style: {
      bgColor: '#111216',
      surfaceColor: '#1a1c22',
      accentColor: '#10b981',
      textColor: '#f4f4f5',
      mutedColor: '#a1a1aa',
      borderRadius: '2xl',
      fontPreset: 'sans_modern',
    },
  },
  luxury_gold: {
    id: 'luxury_gold',
    nameEn: 'Luxury Gold',
    nameAr: 'ذهبي ملكي',
    style: {
      bgColor: '#14110b',
      surfaceColor: '#1f1910',
      accentColor: '#d4af37',
      textColor: '#faf5e8',
      mutedColor: '#c4b496',
      borderRadius: '2xl',
      fontPreset: 'editorial_serif',
    },
    gradientBackdrop: 'linear-gradient(135deg, #14110b 0%, #241c0d 100%)',
  },
  minimal_bw: {
    id: 'minimal_bw',
    nameEn: 'Minimal Black & White',
    nameAr: 'بسيط أبيض وأسود',
    style: {
      bgColor: '#ffffff',
      surfaceColor: '#f4f4f5',
      accentColor: '#18181b',
      textColor: '#09090b',
      mutedColor: '#52525b',
      borderRadius: 'xl',
      fontPreset: 'sans_modern',
    },
  },
  neon_trading: {
    id: 'neon_trading',
    nameEn: 'Neon Trading',
    nameAr: 'تداول نيون',
    style: {
      bgColor: '#090d16',
      surfaceColor: '#111827',
      accentColor: '#22d3ee',
      textColor: '#f8fafc',
      mutedColor: '#94a3b8',
      borderRadius: '2xl',
      fontPreset: 'condensed_display',
    },
    gradientBackdrop: 'linear-gradient(145deg, #090d16 0%, #0f172a 100%)',
  },
  modern_gradient: {
    id: 'modern_gradient',
    nameEn: 'Modern Gradient',
    nameAr: 'تدرج عصري',
    style: {
      bgColor: '#0f172a',
      surfaceColor: '#1e293b',
      accentColor: '#38bdf8',
      textColor: '#f8fafc',
      mutedColor: '#cbd5e1',
      borderRadius: '3xl',
      fontPreset: 'sans_modern',
    },
    gradientBackdrop: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
  },
  special_event: {
    id: 'special_event',
    nameEn: 'Special Event',
    nameAr: 'حدث خاص',
    style: {
      bgColor: '#190f14',
      surfaceColor: '#27151e',
      accentColor: '#f43f5e',
      textColor: '#fff1f2',
      mutedColor: '#fda4af',
      borderRadius: '2xl',
      fontPreset: 'editorial_serif',
    },
    gradientBackdrop: 'linear-gradient(135deg, #190f14 0%, #2a121c 100%)',
  },
  custom: {
    id: 'custom',
    nameEn: 'Custom Design',
    nameAr: 'تصميم مخصص',
    style: {
      bgColor: '#121214',
      surfaceColor: '#1c1c21',
      accentColor: '#10b981',
      textColor: '#fafafa',
      mutedColor: '#a1a1aa',
      borderRadius: '2xl',
      fontPreset: 'sans_modern',
    },
  },
};

export function resolveGiveawayStyle(
  templateId?: string,
  overrides?: Partial<GiveawayStyleConfig>
): { preset: GiveawayTemplatePreset; style: GiveawayStyleConfig } {
  const safeId: GiveawayTemplateId =
    templateId && templateId in GIVEAWAY_TEMPLATES
      ? (templateId as GiveawayTemplateId)
      : 'premium_dark';
  const preset = GIVEAWAY_TEMPLATES[safeId];
  return {
    preset,
    style: {
      ...preset.style,
      ...(overrides || {}),
    },
  };
}

export function getFontFamilyCss(fontPreset: GiveawayFontId): string {
  switch (fontPreset) {
    case 'editorial_serif':
      return "'Playfair Display', Georgia, 'IBM Plex Sans Arabic', serif";
    case 'condensed_display':
      return "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', sans-serif";
    case 'arabic_ibm':
      return "'IBM Plex Sans Arabic', 'Plus Jakarta Sans', sans-serif";
    case 'sans_modern':
    default:
      return "'Plus Jakarta Sans', 'IBM Plex Sans Arabic', -apple-system, sans-serif";
  }
}

export function getRadiusClass(radius: GiveawayStyleConfig['borderRadius']): string {
  switch (radius) {
    case 'md':
      return 'rounded-lg';
    case 'xl':
      return 'rounded-xl';
    case '3xl':
      return 'rounded-3xl';
    case '2xl':
    default:
      return 'rounded-2xl';
  }
}
