import type { SVGProps } from "react";
export interface PackageAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PackageAltIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PackageAltIconProps) {
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
        d="M1.875 18v-2a1.125 1.125 0 0 1 2.25 0v2c0 1.035.84 1.875 1.875 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 22.125H6A4.125 4.125 0 0 1 1.875 18m18 0v-2a1.125 1.125 0 0 1 2.25 0v2A4.125 4.125 0 0 1 18 22.125h-2a1.125 1.125 0 0 1 0-2.25h2c1.035 0 1.875-.84 1.875-1.875m-18-10V6A4.125 4.125 0 0 1 6 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 4.125H6c-1.036 0-1.875.84-1.875 1.875v2a1.125 1.125 0 0 1-2.25 0m18 0V6c0-1.036-.84-1.875-1.875-1.875h-2a1.125 1.125 0 0 1 0-2.25h2A4.125 4.125 0 0 1 22.125 6v2a1.125 1.125 0 0 1-2.25 0m-3.999 2.991-2.752 1.572v3.303l2.31-1.32a.88.88 0 0 0 .442-.758zm-3.441-3.25a.88.88 0 0 0-.87 0L9.269 9.053 12 10.615l2.732-1.562zm-4.31 6.047c0 .313.169.603.44.758l2.31 1.32v-3.303l-2.75-1.572zm10 0a3.13 3.13 0 0 1-1.397 2.603l-.177.11-3 1.713a3.13 3.13 0 0 1-3.101 0l-3-1.713a3.13 3.13 0 0 1-1.575-2.713v-3.573c0-.562.15-1.103.423-1.572l.109-.171A3.1 3.1 0 0 1 7.45 7.5l3-1.713.183-.097a3.13 3.13 0 0 1 2.918.097l3 1.713a3.12 3.12 0 0 1 1.575 2.715z"
      />
    </svg>
  );
}
