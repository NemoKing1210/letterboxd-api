import { isPlaceholderPoster } from '../../../shared/utils';

export function realPoster(url: string | null | undefined): string | null {
  return isPlaceholderPoster(url) ? null : (url ?? null);
}
