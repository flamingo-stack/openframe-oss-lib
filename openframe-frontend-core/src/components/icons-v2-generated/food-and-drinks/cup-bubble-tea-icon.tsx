import type { SVGProps } from "react";
export interface CupBubbleTeaIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CupBubbleTeaIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CupBubbleTeaIconProps) {
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
        d="M18.661 7.882c.617.073 1.059.633.986 1.25l-1.219 10.35a4.125 4.125 0 0 1-4.095 3.643H9.667a4.126 4.126 0 0 1-4.032-3.26l-.063-.383-1.22-10.35-.007-.116a1.126 1.126 0 0 1 2.224-.26l.02.112 1.216 10.35.03.175a1.875 1.875 0 0 0 1.832 1.482h4.666c.95 0 1.75-.712 1.862-1.656l1.217-10.35a1.126 1.126 0 0 1 1.25-.987Z"
      />
      <path
        fill={color}
        d="M10.64 16.883a1.374 1.374 0 1 1-1.507 1.507l-.008-.14.008-.141a1.374 1.374 0 0 1 1.367-1.234zm3.75-3a1.375 1.375 0 1 1-1.507 1.507l-.007-.14.007-.141a1.374 1.374 0 0 1 1.367-1.234zm-4.5-2.001a1.375 1.375 0 1 1-1.507 1.508l-.008-.14.008-.14a1.375 1.375 0 0 1 1.367-1.236zm6.195-10.537a1.126 1.126 0 0 1 1.891 1.213l-.589 1.03a7.6 7.6 0 0 1 2.183 4.287H20l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.005H4a1.125 1.125 0 0 1 0-2.25h.43c.548-3.682 3.748-6.5 7.571-6.5 1.282 0 2.493.318 3.558.878l.464-.811zm-1.147 6.53h2.347a5.35 5.35 0 0 0-1.071-2.233zm-2.937-4.25a5.41 5.41 0 0 0-5.285 4.25h5.63l2.095-3.668a5.4 5.4 0 0 0-2.44-.583Z"
      />
    </svg>
  );
}
