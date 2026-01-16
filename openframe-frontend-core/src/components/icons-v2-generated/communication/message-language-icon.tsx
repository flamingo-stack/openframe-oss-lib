import type { SVGProps } from "react";
export interface MessageLanguageIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MessageLanguageIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MessageLanguageIconProps) {
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
        d="M20.875 6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h2c.62 0 1.125.504 1.125 1.125v1.77l3.534-2.25a4.13 4.13 0 0 1 2.215-.645H19c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 20.125h-5.126c-.268 0-.531.056-.773.166l-.233.128L9.14 22.79c-1.414.9-3.266-.115-3.266-1.791v-.873H5A4.125 4.125 0 0 1 .875 16V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6z"
      />
      <path
        fill={color}
        d="M9.503 16.506a1.125 1.125 0 0 1-1.006-2.012zM10.876 6.5a1.125 1.125 0 0 1 2.25 0v.287h2.873l.116.006a1.125 1.125 0 0 1 0 2.238L16 9.037h-.47a11.6 11.6 0 0 1-1.779 3.763q.213.128.4.223a1.126 1.126 0 0 1-1.006 2.013 9 9 0 0 1-.873-.512c-.84.81-1.778 1.487-2.77 1.982L9 15.5l-.503-1.006a9 9 0 0 0 1.982-1.374 11 11 0 0 1-1.323-1.462l-.21-.3-.058-.097a1.125 1.125 0 0 1 1.861-1.242l.07.092.16.228c.28.377.622.747.988 1.092a9.5 9.5 0 0 0 1.217-2.394H8a1.125 1.125 0 0 1 0-2.25h2.876z"
      />
    </svg>
  );
}
