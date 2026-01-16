import type { SVGProps } from "react";
export interface Arrow01UpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Arrow01UpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Arrow01UpIconProps) {
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
        d="M10.875 19V5a1.125 1.125 0 0 1 2.25 0v14a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M12 3.875c.298 0 .584.119.795.33l6 6 .078.085a1.125 1.125 0 0 1-1.584 1.583l-.085-.078L12 6.591l-5.205 5.204a1.125 1.125 0 1 1-1.59-1.59l6-6 .17-.141c.184-.122.401-.189.625-.189"
      />
    </svg>
  );
}
