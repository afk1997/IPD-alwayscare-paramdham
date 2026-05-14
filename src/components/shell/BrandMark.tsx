interface Props {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 28, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 88"
      aria-label="Arham Always Care"
      role="img"
      className={className}
    >
      <rect width="88" height="88" rx="20" className="fill-accent" />
      <circle cx="32" cy="42" r="6" className="fill-accent-fg" />
      <circle cx="44" cy="36" r="6" className="fill-accent-fg" />
      <circle cx="56" cy="42" r="6" className="fill-accent-fg" />
      <circle cx="38" cy="50" r="5" className="fill-accent-fg" />
      <circle cx="50" cy="50" r="5" className="fill-accent-fg" />
      <path
        d="M34 60 C34 54 38 50 44 50 C50 50 54 54 54 60 C54 66 50 70 44 70 C38 70 34 66 34 60 Z"
        className="fill-accent-fg"
      />
    </svg>
  );
}
