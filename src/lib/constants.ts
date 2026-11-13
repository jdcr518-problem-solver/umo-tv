export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'GLOBAL', name: 'Global (All Countries)', flag: '🌐' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
];

export type GenderPreference = 'all' | 'female' | 'male';

export interface GenderOption {
  id: GenderPreference;
  label: string;
  subtitle: string;
  icon: string;
}

export const GENDER_OPTIONS: GenderOption[] = [
  {
    id: 'all',
    label: 'Anyone (All Genders)',
    subtitle: 'Fastest matching with all online users',
    icon: '👥',
  },
  {
    id: 'female',
    label: 'Women Only',
    subtitle: 'Prioritize pairings with female users',
    icon: '👩',
  },
  {
    id: 'male',
    label: 'Men Only',
    subtitle: 'Prioritize pairings with male users',
    icon: '👨',
  },
];

export function getCountryFlag(countryNameOrCode?: string): string {
  if (!countryNameOrCode) return '';
  const query = countryNameOrCode.trim().toLowerCase();
  const match = COUNTRIES.find(
    (c) => c.name.toLowerCase() === query || c.code.toLowerCase() === query
  );
  return match ? match.flag : '🌐';
}

export function getGenderLabel(gender: GenderPreference): string {
  switch (gender) {
    case 'female':
      return 'Women';
    case 'male':
      return 'Men';
    default:
      return 'All';
  }
}

export function getGenderIcon(gender: GenderPreference): string {
  switch (gender) {
    case 'female':
      return '👩';
    case 'male':
      return '👨';
    default:
      return '👥';
  }
}

export interface ChatMessageItem {
  id: string;
  sender: 'self' | 'peer';
  text: string;
  timestamp: number;
}


