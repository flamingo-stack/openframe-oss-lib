import type { SVGProps } from "react";
export interface CakeBirthdayIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CakeBirthdayIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CakeBirthdayIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M19.875 18.67V12.1l-1.642 1.096a3.12 3.12 0 0 1-3.267.123l-.199-.123-2.282-1.52a.88.88 0 0 0-.856-.065l-.114.064-2.282 1.52a3.12 3.12 0 0 1-3.267.124l-.199-.123L4.125 12.1v6.57a1.125 1.125 0 0 1-2.25 0V9a4.12 4.12 0 0 1 4-4.119V2a1.125 1.125 0 0 1 2.25 0v2.875h2.75V2a1.125 1.125 0 0 1 2.25 0v2.875h2.75V2a1.125 1.125 0 0 1 2.25 0v2.881c2.22.066 4 1.883 4 4.12v9.669a1.125 1.125 0 0 1-2.25 0M6 7.125c-1.036 0-1.875.84-1.875 1.875v.396l2.89 1.928.114.064a.87.87 0 0 0 .856-.064l2.282-1.52c1.05-.7 2.417-.7 3.466 0l2.282 1.52a.87.87 0 0 0 .97 0l2.89-1.928V9c0-1.035-.84-1.875-1.875-1.875z"
      />
      <path
        fill={color}
        d="M20.875 20.25a.625.625 0 0 0-.625-.625H3.75a.626.626 0 0 0 0 1.25h16.5c.345 0 .624-.28.625-.625m2.25 0a2.874 2.874 0 0 1-2.875 2.875H3.75a2.875 2.875 0 1 1 0-5.75h16.5a2.875 2.875 0 0 1 2.875 2.875"
      />
    </svg>
  );
}
