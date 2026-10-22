import type { SVGProps } from "react";
export interface FolderShieldClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderShieldClassicIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: FolderShieldClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 65 64"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke={color}
        d="M13.664 56h37.333a8 8 0 0 0 8-8V24a8 8 0 0 0-8-8H36.102a2.67 2.67 0 0 1-1.886-.781l-6.438-6.438c-.5-.5-1.178-.781-1.885-.781H13.664a8 8 0 0 0-8 8v32a8 8 0 0 0 8 8Z"
      />
      <path
        stroke={color}
        d="m40.927 29.472-8-4a1.33 1.33 0 0 0-1.193 0l-8 4a1.33 1.33 0 0 0-.737 1.192v5.663c0 4.943 6.703 9.048 8.748 10.186.367.204.805.204 1.171 0 2.046-1.138 8.748-5.243 8.748-10.186v-5.663c0-.505-.285-.967-.737-1.193Z"
      />
    </svg>
  );
}
