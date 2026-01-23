import type { SVGProps } from "react";
export interface BriefcaseMedicalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BriefcaseMedicalIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BriefcaseMedicalIconProps) {
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
        d="M11.626 12.5c0 .621-.505 1.125-1.125 1.126H9.125v.75h1.376c.62 0 1.125.503 1.125 1.125v1.374h.75V15.5c0-.622.503-1.125 1.125-1.125h1.373v-.75h-1.373a1.125 1.125 0 0 1-1.125-1.125v-1.376h-.75zm3-1.124h.874c.898 0 1.625.726 1.625 1.624v2c0 .897-.727 1.625-1.625 1.625h-.874v.875c0 .898-.729 1.625-1.627 1.625H11A1.624 1.624 0 0 1 9.375 17.5v-.875H8.5A1.626 1.626 0 0 1 6.875 15v-2c0-.897.727-1.624 1.625-1.624h.875v-.877c0-.897.728-1.624 1.625-1.624h2c.897 0 1.625.727 1.626 1.624z"
      />
      <path
        fill={color}
        d="M20.875 9c0-1.035-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zm-6-5A.875.875 0 0 0 14 3.125h-4A.875.875 0 0 0 9.125 4v.875h5.75zm2.25.875H19A4.125 4.125 0 0 1 23.125 9v10A4.125 4.125 0 0 1 19 23.125H5A4.125 4.125 0 0 1 .875 19V9A4.125 4.125 0 0 1 5 4.875h1.875V4A3.125 3.125 0 0 1 10 .875h4A3.125 3.125 0 0 1 17.125 4z"
      />
    </svg>
  );
}
