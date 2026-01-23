import type { SVGProps } from "react";
export interface ClipboardMedicalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ClipboardMedicalIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ClipboardMedicalIconProps) {
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
        d="M2.875 19V6A4.125 4.125 0 0 1 7 1.875h1.25l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H7c-1.036 0-1.875.84-1.875 1.875v13c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875V6c0-1.035-.84-1.875-1.875-1.875h-1.25a1.125 1.125 0 0 1 0-2.25H17A4.125 4.125 0 0 1 21.125 6v13A4.126 4.126 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19"
      />
      <path
        fill={color}
        d="M11.626 12.5c0 .621-.504 1.125-1.125 1.125H9.125v.75h1.376c.62 0 1.125.504 1.125 1.125v1.375h.75V15.5c0-.621.503-1.125 1.125-1.125h1.373v-.75h-1.373a1.125 1.125 0 0 1-1.125-1.125v-1.376h-.75zm3-1.125h.874c.897 0 1.624.727 1.625 1.624v2.002c0 .897-.728 1.624-1.625 1.624h-.874v.875c0 .897-.729 1.625-1.627 1.625H11A1.625 1.625 0 0 1 9.375 17.5v-.875H8.5a1.625 1.625 0 0 1-1.625-1.624v-2.002c0-.897.727-1.624 1.625-1.624h.875v-.874c0-.898.727-1.626 1.625-1.626h2c.897 0 1.626.728 1.626 1.626zM14.873 4A.875.875 0 0 0 14 3.125h-4A.875.875 0 0 0 9.125 4v.375h5.75V4Zm2.25 1c0 .897-.726 1.625-1.624 1.625h-7A1.625 1.625 0 0 1 6.875 5V4A3.125 3.125 0 0 1 10 .875h4A3.125 3.125 0 0 1 17.125 4v1Z"
      />
    </svg>
  );
}
