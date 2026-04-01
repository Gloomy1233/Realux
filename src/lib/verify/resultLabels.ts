import type { VerificationResultLabel } from '@/types/verification';

export function verificationResultTitle(label: VerificationResultLabel): string {
  switch (label) {
    case 'verified':
      return 'Verified';
    case 'not_verified':
      return 'Not verified';
    case 'tampered_or_changed':
      return 'Tampered or changed';
    case 'unknown_provenance':
      return 'Unknown provenance';
    default:
      return 'Unknown provenance';
  }
}
