import type { SVGProps } from "react";
export interface Flag01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Flag01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Flag01IconProps) {
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
        d="M8 .875c1.747 0 3.189.59 4.418 1.081 1.27.508 2.329.919 3.582.919 1.745 0 2.56-.413 3.497-.88A1.126 1.126 0 0 1 21.125 3v12c0 .426-.241.816-.622 1.007-1.064.532-2.248 1.117-4.503 1.117-1.747 0-3.188-.587-4.418-1.08-1.27-.507-2.328-.919-3.582-.919-1.745 0-2.561.414-3.498.882a1.125 1.125 0 0 1-1.004-2.013C4.56 13.462 5.746 12.875 8 12.875c1.747 0 3.189.59 4.418 1.081 1.27.508 2.329.918 3.582.918 1.356 0 2.15-.25 2.875-.581V4.706c-.744.243-1.652.419-2.875.419-1.747 0-3.188-.588-4.418-1.08-1.27-.508-2.328-.92-3.582-.92-1.745 0-2.561.414-3.498.882a1.125 1.125 0 0 1-1.004-2.013C4.56 1.462 5.746.875 8 .875"
      />
      <path
        fill={color}
        d="M2.875 22V2a1.125 1.125 0 0 1 2.25 0v20a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
