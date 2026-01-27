import type { SVGProps } from "react";
export interface UnlockKeyholeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UnlockKeyholeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UnlockKeyholeIconProps) {
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
        d="M6.875 10V6a5.126 5.126 0 0 1 10.088-1.28 1.125 1.125 0 1 1-2.178.56 2.876 2.876 0 0 0-5.66.72v4a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M18.875 13c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v6c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zM11.5 14.629a.62.62 0 0 0-.124.37l.011.127c.019.09.06.172.113.244zm1 .741a.6.6 0 0 0 .112-.244l.013-.127-.013-.126a.6.6 0 0 0-.111-.244zm1.126-.37c0 .46-.194.876-.502 1.171V18a1.125 1.125 0 0 1-2.25 0v-1.83c-.27-.26-.45-.61-.49-1.004L10.375 15l.009-.165a1.625 1.625 0 0 1 1.615-1.459l.167.009c.82.083 1.46.774 1.46 1.615m7.5 4A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19v-6A4.125 4.125 0 0 1 7 8.875h10A4.125 4.125 0 0 1 21.125 13v6Z"
      />
    </svg>
  );
}
