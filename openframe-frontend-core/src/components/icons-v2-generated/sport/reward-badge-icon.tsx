import type { SVGProps } from "react";
export interface RewardBadgeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RewardBadgeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RewardBadgeIconProps) {
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
        d="M17.625 21.247a1.876 1.876 0 0 1-2.146 1.857l-.224-.049-3.02-.826a.9.9 0 0 0-.348-.023l-.114.023-3.03.828a1.875 1.875 0 0 1-2.368-1.81V16.62a1.125 1.125 0 1 1 2.25 0v4.135l2.555-.697.203-.048c.478-.097.973-.08 1.445.05l2.547.695V16.62a1.125 1.125 0 1 1 2.25 0z"
      />
      <path
        fill={color}
        d="M18.875 10a6.876 6.876 0 1 0-13.751.002A6.876 6.876 0 0 0 18.876 10Zm2.25 0a9.126 9.126 0 1 1-18.25 0 9.126 9.126 0 0 1 18.25 0"
      />
    </svg>
  );
}
