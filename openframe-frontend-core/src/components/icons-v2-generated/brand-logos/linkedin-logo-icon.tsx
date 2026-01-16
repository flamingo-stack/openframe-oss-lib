import type { SVGProps } from "react";
export interface LinkedinLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LinkedinLogoIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LinkedinLogoIconProps) {
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
        fill="#069"
        d="M2 3.467c0-.788.662-1.427 1.478-1.427h17.044c.816 0 1.478.64 1.478 1.427v17.066c0 .788-.662 1.427-1.478 1.427H3.478C2.662 21.96 2 21.321 2 20.533z"
      />
      <path
        fill="#fff"
        d="M8.078 18.71V9.742H5.085v8.968zM6.582 8.518c1.044 0 1.693-.689 1.693-1.55-.02-.88-.65-1.549-1.673-1.549s-1.693.67-1.693 1.55c0 .86.65 1.55 1.654 1.55zM9.734 18.71h2.993v-5.007c0-.268.02-.536.099-.727.216-.536.708-1.09 1.535-1.09 1.083 0 1.516.822 1.516 2.027v4.797h2.993v-5.142c0-2.754-1.477-4.036-3.446-4.036-1.614 0-2.323.899-2.717 1.51h.02v-1.3H9.735c.039.842 0 8.969 0 8.969Z"
      />
    </svg>
  );
}
