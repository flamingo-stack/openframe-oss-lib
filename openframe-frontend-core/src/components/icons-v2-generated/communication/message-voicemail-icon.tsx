import type { SVGProps } from "react";
export interface MessageVoicemailIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MessageVoicemailIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MessageVoicemailIconProps) {
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
        d="M8.875 11a.876.876 0 1 0-1.751.002A.876.876 0 0 0 8.875 11m8 0a.875.875 0 1 0-1.75 0 .875.875 0 0 0 1.75 0m2.25 0c0 1.617-1.23 2.95-2.805 3.11l-.32.016H8a3.126 3.126 0 1 1 3.126-3.127c0 .305-.047.598-.128.877h2.004a3.1 3.1 0 0 1-.128-.877 3.126 3.126 0 0 1 6.251 0Z"
      />
    </svg>
  );
}
