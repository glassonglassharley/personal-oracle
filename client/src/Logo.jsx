const LOGO_FULL_SRC = '/logo.png';
const LOGO_MARK_SRC = '/favicon.svg';

export function VtvLogo({ className, style }) {
  return (
    <img
      src={LOGO_FULL_SRC}
      alt="Vice to Value"
      className={className}
      style={style}
    />
  );
}

export function VtvMark({ className, style }) {
  return (
    <img
      src={LOGO_MARK_SRC}
      alt="Vice to Value"
      className={className}
      style={style}
    />
  );
}
