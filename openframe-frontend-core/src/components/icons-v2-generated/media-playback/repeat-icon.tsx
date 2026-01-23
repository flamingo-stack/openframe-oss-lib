import type { SVGProps } from "react";
export interface RepeatIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RepeatIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RepeatIconProps) {
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
        d="M5.205 15.204a1.125 1.125 0 1 1 1.59 1.591l-1.08 1.08H18c1.035 0 1.875-.84 1.875-1.875v-3a1.125 1.125 0 0 1 2.25 0v3l-.022.422A4.125 4.125 0 0 1 18 20.125H5.716l1.08 1.08.077.085a1.125 1.125 0 0 1-1.583 1.583l-.085-.078-3-3a1.125 1.125 0 0 1 0-1.59zM1.875 11V8A4.125 4.125 0 0 1 6 3.875h12.284l-1.08-1.08-.077-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078 3 3c.44.439.44 1.151 0 1.59l-3 3a1.125 1.125 0 1 1-1.59-1.59l1.08-1.08H6c-1.036 0-1.875.84-1.875 1.875v3a1.125 1.125 0 1 1-2.25 0"
      />
    </svg>
  );
}
