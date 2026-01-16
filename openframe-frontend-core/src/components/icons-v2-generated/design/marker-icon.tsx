import type { SVGProps } from "react";
export interface MarkerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MarkerIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MarkerIconProps) {
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
        d="M3.099 17.306a1.125 1.125 0 0 1 1.903 1.2l-1.11 1.757.601.077 1.587-.856a1.126 1.126 0 0 1 1.07 1.98l-1.905 1.027a1.13 1.13 0 0 1-.676.126l-2.71-.342a1.124 1.124 0 0 1-.812-1.716zM4.34 11.53a1.127 1.127 0 0 1 1.592 0l7.055 7.055.076.085a1.125 1.125 0 0 1-1.582 1.584l-.085-.078-7.056-7.055a1.126 1.126 0 0 1 0-1.59Z"
      />
      <path
        fill={color}
        d="M15.402 2.117a4.2 4.2 0 0 1 5.354.491l1.137 1.14.272.299a4.21 4.21 0 0 1 .219 5.06l-.245.321-8.627 10.273a3.2 3.2 0 0 1-1.299.925l-.22.074-3.955 1.188a2.15 2.15 0 0 1-1.919-.345l-.22-.194-2.724-2.727a2.15 2.15 0 0 1-.54-2.14l1.187-3.961.075-.219c.192-.503.509-.951.923-1.3l10.26-8.638zM19.164 4.2a1.95 1.95 0 0 0-2.486-.229l-.15.115-10.26 8.638a.9.9 0 0 0-.242.318l-.049.126-1.17 3.903 2.64 2.646 3.899-1.17.126-.049a.9.9 0 0 0 .316-.243l8.627-10.273.114-.15a1.96 1.96 0 0 0-.101-2.355l-.126-.139z"
      />
    </svg>
  );
}
