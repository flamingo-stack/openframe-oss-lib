import type { SVGProps } from "react";
export interface ScaleBalancedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ScaleBalancedIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ScaleBalancedIconProps) {
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
        d="M12 1c1.306 0 2.414.835 2.826 2H18.5a1 1 0 1 1 0 2h-3.674A3 3 0 0 1 13 6.825V21h5.5a1 1 0 1 1 0 2h-13a1 1 0 1 1 0-2H11V6.825A3 3 0 0 1 9.174 5H5.5a1 1 0 0 1 0-2h3.674c.412-1.165 1.52-2 2.826-2m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      />
      <path
        fill={color}
        d="M3.674 7.568c.555-1.065 2.097-1.065 2.652 0l.053.11 2.54 5.928A1 1 0 0 1 9 14c0 1.735-1.309 4-4 4s-4-2.265-4-4a1 1 0 0 1 .081-.394l2.54-5.928zm14 0c.555-1.065 2.097-1.065 2.652 0l.053.11 2.54 5.928A1 1 0 0 1 23 14c0 1.735-1.309 4-4 4s-4-2.265-4-4c0-.136.028-.27.081-.394l2.54-5.928zM3.009 14.183C3.093 15.066 3.777 16 5 16s1.906-.934 1.99-1.817L5 9.54zm14 0C17.093 15.066 17.777 16 19 16s1.906-.934 1.99-1.817L19 9.54z"
      />
    </svg>
  );
}
