import type { SVGProps } from "react";
export interface BookMedicalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BookMedicalIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BookMedicalIconProps) {
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
        d="M18.875 4A.876.876 0 0 0 18 3.125H7c-1.036 0-1.875.84-1.875 1.875v12.002c.278-.081.57-.127.875-.127h12a.877.877 0 0 0 .875-.876zM5.143 20.176a.875.875 0 0 0 .857.699h11.875v-1.75H6a.875.875 0 0 0-.875.875zM21.125 16c0 .904-.386 1.715-1 2.286v2.596a1.126 1.126 0 0 1-.01 2.237l-.114.006H6a3.125 3.125 0 0 1-3.109-2.806L2.875 20V5A4.125 4.125 0 0 1 7 .875h11A3.126 3.126 0 0 1 21.125 4z"
      />
      <path
        fill={color}
        d="M11.626 8.5c0 .621-.505 1.125-1.125 1.125H9.125v.75h1.376c.62 0 1.125.504 1.125 1.126v1.373h.75v-1.373c0-.622.503-1.125 1.125-1.125h1.373v-.75h-1.373A1.125 1.125 0 0 1 12.376 8.5V7.125h-.75zm3-1.125h.874c.898 0 1.625.728 1.625 1.625v2c0 .897-.727 1.626-1.625 1.626h-.874v.874c0 .898-.729 1.624-1.627 1.624H11A1.624 1.624 0 0 1 9.375 13.5v-.874H8.5a1.626 1.626 0 0 1-1.625-1.627V9c0-.897.727-1.624 1.625-1.625h.875V6.5c0-.898.728-1.625 1.625-1.625h2c.897 0 1.625.727 1.626 1.625z"
      />
    </svg>
  );
}
