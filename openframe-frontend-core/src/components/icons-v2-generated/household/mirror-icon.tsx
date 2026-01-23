import type { SVGProps } from "react";
export interface MirrorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MirrorIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MirrorIconProps) {
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
        d="M19.875 22v-.875H4.125V22a1.125 1.125 0 1 1-2.25 0V8a1.125 1.125 0 0 1 2.25 0v2.874H6.5l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005H4.125v5.751h15.75v-5.75H17.5a1.125 1.125 0 1 1 0-2.25h2.375V8a1.125 1.125 0 0 1 2.25 0v14a1.125 1.125 0 1 1-2.25 0m-7.67-15.296a1.125 1.125 0 0 1 1.59 1.591l-3 3a1.125 1.125 0 1 1-1.59-1.59l3-3Zm-2-2a1.125 1.125 0 0 1 1.59 1.591l-1 1a1.125 1.125 0 0 1-1.59-1.59l1-1Z"
      />
      <path
        fill={color}
        d="M16.375 7.5a4.375 4.375 0 1 0-8.75 0v7.876h8.75zm2.25 8a2.125 2.125 0 0 1-2.125 2.125h-9A2.126 2.126 0 0 1 5.375 15.5v-8a6.626 6.626 0 0 1 13.25 0z"
      />
    </svg>
  );
}
