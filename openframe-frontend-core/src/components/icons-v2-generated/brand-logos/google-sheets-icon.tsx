import type { SVGProps } from "react";
export interface GoogleSheetsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GoogleSheetsIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GoogleSheetsIconProps) {
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
      <defs>
        <mask id="sheets-grid">
          <rect width="24" height="24" fill="white" />
          {/* Grid cells cut out as transparent */}
          <rect x="7" y="10" width="4" height="2" fill="black" />
          <rect x="7" y="13" width="4" height="2" fill="black" />
          <rect x="7" y="16" width="4" height="2" fill="black" />
          <rect x="13" y="10" width="4" height="2" fill="black" />
          <rect x="13" y="13" width="4" height="2" fill="black" />
          <rect x="13" y="16" width="4" height="2" fill="black" />
        </mask>
      </defs>
      <path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm8 1.5V8h4.5L14 3.5Z"
        mask="url(#sheets-grid)"
      />
    </svg>
  );
}
