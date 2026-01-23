import type { SVGProps } from "react";
export interface SpeedTrainIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SpeedTrainIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SpeedTrainIconProps) {
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
        d="M4.79 2.927a1.125 1.125 0 0 1 1.369.63l.04.108 1.063 3.403.052.189a3.125 3.125 0 0 1-3.035 3.868H2a1.125 1.125 0 1 1 0-2.25h2.28a.875.875 0 0 0 .86-1.03l-.026-.106-1.063-3.403-.028-.112a1.125 1.125 0 0 1 .766-1.297Zm4.5 0a1.125 1.125 0 0 1 1.369.63l.04.108 1.216 3.895c.245.782.97 1.315 1.79 1.315H20a1.125 1.125 0 0 1 0 2.25h-6.294c-1.692 0-3.2-1.03-3.825-2.578l-.113-.316-1.217-3.895-.028-.112a1.125 1.125 0 0 1 .766-1.297ZM19.624 13.5a1.376 1.376 0 0 1-2.742.14l-.008-.14.008-.14a1.374 1.374 0 0 1 1.367-1.234l.14.007c.694.07 1.235.655 1.235 1.367"
      />
      <path
        fill={color}
        d="m22 19.875.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H2a1.125 1.125 0 0 1 0-2.25zm-1.125-5.833c0-.883-.307-1.734-.862-2.411l-.252-.279-3.628-3.627a8.88 8.88 0 0 0-6.276-2.6H2a1.125 1.125 0 0 1 0-2.25h7.857c2.951 0 5.782 1.172 7.868 3.258l3.627 3.628.207.217a6.06 6.06 0 0 1 1.566 4.064 4.083 4.083 0 0 1-4.083 4.084H2a1.125 1.125 0 0 1 0-2.25h17.042a1.833 1.833 0 0 0 1.832-1.834Z"
      />
    </svg>
  );
}
