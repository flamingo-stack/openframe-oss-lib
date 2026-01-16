import type { SVGProps } from "react";
export interface RobotIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RobotIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: RobotIconProps) {
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
        d="M.375 16.5v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m21 0v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0M10.875 7V4.8a2.12 2.12 0 0 1-.989-1.583L9.875 3l.011-.218a2.125 2.125 0 0 1 4.24.218 2.12 2.12 0 0 1-1.001 1.8V7a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.375 10c0-1.036-.84-1.875-1.875-1.875h-11c-1.036 0-1.875.84-1.875 1.875v9c0 1.035.84 1.875 1.875 1.875h11c1.035 0 1.875-.84 1.875-1.875zm-4.876 7.375.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H9.5a1.125 1.125 0 0 1 0-2.25zm-6.282-6.489a2.125 2.125 0 1 1-2.33 2.33L5.874 13l.011-.217A2.125 2.125 0 0 1 8 10.874zm8 0a2.125 2.125 0 1 1-2.331 2.33l-.01-.216.01-.217A2.126 2.126 0 0 1 16 10.874l.218.012ZM21.626 19a4.125 4.125 0 0 1-4.125 4.125h-11A4.125 4.125 0 0 1 2.375 19v-9A4.125 4.125 0 0 1 6.5 5.875h11A4.125 4.125 0 0 1 21.625 10v9Z"
      />
    </svg>
  );
}
