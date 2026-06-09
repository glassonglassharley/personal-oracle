import { VtvLogo, VtvMark } from '../Logo';

/**
 * Unified Logo component for the Vice to Value brand.
 *
 * @param {number}  size    Height in px (width auto-scales). Default 40.
 * @param {'icon'|'full'} variant  'icon' = V mark only, 'full' = full wordmark lockup.
 * @param {boolean} pulse   Gentle breathing animation (useful on loading screens).
 */
export default function Logo({ size = 40, variant = 'icon', pulse = false }) {
  const style = {
    height: size,
    width: 'auto',
    flexShrink: 0,
    ...(variant === 'full' ? { borderRadius: Math.round(size * 0.14) } : {}),
    ...(pulse ? { animation: 'vtv-logo-pulse 2s ease-in-out infinite' } : {}),
  };

  return variant === 'full'
    ? <VtvLogo style={style} />
    : <VtvMark style={style} />;
}
