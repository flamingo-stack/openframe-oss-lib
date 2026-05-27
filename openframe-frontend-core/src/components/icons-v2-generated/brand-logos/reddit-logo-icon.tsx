import type { SVGProps } from "react";
export interface RedditLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RedditLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RedditLogoIconProps) {
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
        fill="#FF4500"
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10"
      />
      <path
        fill="#fff"
        d="M18.67 12a1.47 1.47 0 0 1-.473 1.098q-.151.14-.337.232a3 3 0 0 1 0 .44c0 2.24-2.61 4.06-5.83 4.06S6.2 16.01 6.2 13.77a3 3 0 0 1 0-.44 1.461 1.461 0 0 1 .447-2.777 1.46 1.46 0 0 1 1.163.387 7.2 7.2 0 0 1 2.868-1.14 7 7 0 0 1 1.032-.09l.74-3.47a.31.31 0 0 1 .37-.24l2.45.49a1 1 0 1 1-.13.61L13 6.65l-.65 3.12A7.1 7.1 0 0 1 16.2 11a1.46 1.46 0 0 1 2.47 1m-9.924 1.383a1.001 1.001 0 0 0 1.848 0 1 1 0 1 0-1.848 0m5.728 2.4a.27.27 0 0 0-.185-.463.33.33 0 0 0-.199.07A3.28 3.28 0 0 1 12 16a3.27 3.27 0 0 1-2.08-.63.27.27 0 0 0-.38.38 3.84 3.84 0 0 0 2.47.77 3.86 3.86 0 0 0 1.912-.42q.294-.151.558-.35zm-.184-1.703a1 1 0 0 0 1.01-1.04 1 1 0 1 0-1 1z"
      />
    </svg>
  );
}
