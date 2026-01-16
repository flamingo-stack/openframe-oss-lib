import type { SVGProps } from "react";
export interface SkippingRopeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SkippingRopeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SkippingRopeIconProps) {
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
        d="M14.875 6a2.876 2.876 0 1 0-5.752.001 2.876 2.876 0 0 0 5.752 0Zm2.25 0a5.125 5.125 0 1 1-10.211-.626A6.85 6.85 0 0 0 5.125 10v3a1.125 1.125 0 0 1-2.25 0v-3A9.125 9.125 0 0 1 11.999.875l.47.012A9.126 9.126 0 0 1 21.126 10v3a1.125 1.125 0 0 1-2.25 0v-3a6.85 6.85 0 0 0-1.79-4.625q.039.308.04.625Z"
      />
      <path
        fill={color}
        d="M5.49 11.875a1.626 1.626 0 0 1 1.54 2.148l-.086.203-.482.962.625 4.372a3.124 3.124 0 1 1-6.184 0l.625-4.371-.482-.963A1.624 1.624 0 0 1 2.5 11.875h2.992Zm16.006 0a1.626 1.626 0 0 1 1.54 2.148l-.087.203-.482.961.625 4.373a3.124 3.124 0 1 1-6.186 0l.624-4.373-.48-.96a1.625 1.625 0 0 1 1.453-2.352zm-17.8 2.622c.103.205.14.436.107.662l-.674 4.718a.874.874 0 1 0 1.732 0l-.674-4.718a1.13 1.13 0 0 1 .107-.662l.186-.372h-.97zm16.005 0c.102.205.14.436.107.662l-.674 4.718a.874.874 0 1 0 1.73 0l-.674-4.718a1.12 1.12 0 0 1 .109-.662l.186-.372h-.97z"
      />
    </svg>
  );
}
