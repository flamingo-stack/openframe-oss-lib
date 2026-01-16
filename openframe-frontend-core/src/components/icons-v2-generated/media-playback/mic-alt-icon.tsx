import type { SVGProps } from "react";
export interface MicAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MicAltIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MicAltIconProps) {
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
        d="M2.875 10.5a1.125 1.125 0 0 1 2.25 0 6.875 6.875 0 0 0 6.874 6.875l.355-.01a6.875 6.875 0 0 0 6.521-6.865 1.125 1.125 0 0 1 2.25 0c0 4.659-3.492 8.498-8 9.053v1.322h1.874l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H9a1.126 1.126 0 0 1 0-2.25h1.875v-1.322c-4.508-.555-7.999-4.395-7.999-9.053Z"
      />
      <path
        fill={color}
        d="M12 .875A5.125 5.125 0 0 1 17.126 6v4.5a5.124 5.124 0 0 1-10.25 0V6A5.126 5.126 0 0 1 12.001.875Zm-2.875 9.626a2.875 2.875 0 0 0 5.68.623h-1.806a1.125 1.125 0 0 1 0-2.25h1.875V7.626H13a1.125 1.125 0 0 1 0-2.25h1.805A2.874 2.874 0 0 0 9.125 6z"
      />
    </svg>
  );
}
