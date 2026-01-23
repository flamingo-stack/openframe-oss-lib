import type { SVGProps } from "react";
export interface MailboxIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MailboxIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MailboxIconProps) {
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
        d="M20.875 17v-7A3.875 3.875 0 0 0 17 6.125H6.5a1.125 1.125 0 0 1 0-2.25H17A6.125 6.125 0 0 1 23.125 10v7A3.124 3.124 0 0 1 20 20.125H6.5a1.125 1.125 0 0 1 0-2.25H20a.874.874 0 0 0 .875-.875M11 13.876l.116.005a1.125 1.125 0 0 1 0 2.239l-.116.005H2a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M9.875 9.5a3.375 3.375 0 0 0-6.75 0V17c0 .483.391.874.875.875h5A.875.875 0 0 0 9.875 17zm2.25 7.5A3.125 3.125 0 0 1 9 20.125H4A3.125 3.125 0 0 1 .875 17V9.5a5.625 5.625 0 0 1 11.25 0z"
      />
    </svg>
  );
}
