import type { SVGProps } from "react";
export interface PodcastIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PodcastIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PodcastIconProps) {
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
        d="M19.875 11a7.875 7.875 0 1 0-12.598 6.303l.393.276.094.069a1.125 1.125 0 0 1-1.234 1.867l-.1-.059-.502-.352A10.11 10.11 0 0 1 1.875 11C1.875 5.408 6.408.875 12 .875S22.125 5.408 22.125 11c0 3.535-1.812 6.646-4.553 8.455a1.125 1.125 0 1 1-1.239-1.878A7.87 7.87 0 0 0 19.875 11m-4 0a3.874 3.874 0 1 0-7.75 0c0 .58.126 1.13.354 1.622l.104.206.05.104a1.126 1.126 0 0 1-1.974 1.06l-.06-.1-.164-.329A6.124 6.124 0 1 1 18.125 11a6.1 6.1 0 0 1-.724 2.892 1.126 1.126 0 0 1-1.983-1.064A3.85 3.85 0 0 0 15.875 11"
      />
      <path
        fill={color}
        d="M12 13.874c.434 0 .869.1 1.268.3.525.262.857.8.856 1.388 0 2.025-.013 3.976-.375 6.245a1.52 1.52 0 0 1-1.019 1.2 2.3 2.3 0 0 1-1.28.052l-.18-.053a1.52 1.52 0 0 1-1.02-1.2c-.362-2.268-.374-4.219-.375-6.244 0-.588.332-1.126.858-1.389l.305-.13c.31-.112.637-.168.963-.168Zm.217-4.989a2.125 2.125 0 1 1-2.332 2.332L9.875 11l.01-.217a2.126 2.126 0 0 1 2.116-1.907z"
      />
    </svg>
  );
}
