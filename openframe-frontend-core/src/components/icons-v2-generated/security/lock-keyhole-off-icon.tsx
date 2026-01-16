import type { SVGProps } from "react";
export interface LockKeyholeOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LockKeyholeOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LockKeyholeOffIconProps) {
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
        d="M18.875 14.346v-1.347c0-1.035-.84-1.874-1.875-1.875h-1.346a1.125 1.125 0 0 1-.78-1.935V6a2.876 2.876 0 0 0-5.028-1.904A1.125 1.125 0 0 1 8.16 2.605 5.126 5.126 0 0 1 17.124 6v2.88c2.22.065 4 1.882 4.001 4.118v1.347a1.125 1.125 0 0 1-2.25 0ZM2.874 13a4.12 4.12 0 0 1 4-4.12v-.414l-5.67-5.67-.077-.086A1.125 1.125 0 0 1 2.71 1.127l.085.078 20 19.999.077.087a1.124 1.124 0 0 1-1.581 1.581l-.087-.077-1.093-1.093A4.11 4.11 0 0 1 17 23.124H7A4.125 4.125 0 0 1 2.873 19zm8.625 1.628a.62.62 0 0 0-.124.372l.013.126a.6.6 0 0 0 .111.244zm1 .742a.6.6 0 0 0 .114-.244l.011-.126-.011-.126a.6.6 0 0 0-.113-.246zM5.125 19c0 1.035.84 1.874 1.875 1.874h10a1.87 1.87 0 0 0 1.514-.77L13.61 15.2a1.62 1.62 0 0 1-.485.968V18a1.126 1.126 0 0 1-2.25 0v-1.83a1.62 1.62 0 0 1-.492-1.004L10.374 15l.01-.167a1.626 1.626 0 0 1 1.413-1.445l-2.263-2.264H6.999c-1.035 0-1.874.84-1.875 1.875v6Z"
      />
    </svg>
  );
}
