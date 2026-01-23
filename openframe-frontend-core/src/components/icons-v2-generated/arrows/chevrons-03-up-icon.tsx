import type { SVGProps } from "react";
export interface Chevrons03UpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevrons03UpIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Chevrons03UpIconProps) {
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
        d="M11.29 12.127a1.125 1.125 0 0 1 1.505.078l6 6 .078.085a1.125 1.125 0 0 1-1.584 1.583l-.085-.078L12 14.591l-5.205 5.204a1.125 1.125 0 1 1-1.59-1.59l6-6z"
      />
      <path
        fill={color}
        d="M12 3.875c.298 0 .584.119.795.33l6 6 .078.085a1.125 1.125 0 0 1-1.584 1.583l-.085-.078L12 6.591l-5.205 5.204a1.125 1.125 0 0 1-1.59-1.59l6-6 .17-.141c.184-.122.401-.189.625-.189"
      />
    </svg>
  );
}
