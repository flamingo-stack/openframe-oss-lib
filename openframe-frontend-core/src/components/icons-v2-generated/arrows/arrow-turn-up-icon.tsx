import type { SVGProps } from "react";
export interface ArrowTurnUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowTurnUpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrowTurnUpIconProps) {
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
        d="M8.875 14V3a1.125 1.125 0 1 1 2.25 0v11A4.875 4.875 0 0 0 16 18.874h4l.115.005a1.126 1.126 0 0 1 0 2.239l-.115.006h-4a7.125 7.125 0 0 1-7.125-7.126Z"
      />
      <path
        fill={color}
        d="M10 1.875c.298 0 .584.119.795.33l6 6 .078.085a1.126 1.126 0 0 1-1.584 1.583l-.085-.078L10 4.591 4.795 9.795a1.125 1.125 0 1 1-1.59-1.59l6-6 .17-.141c.184-.122.401-.189.625-.189"
      />
    </svg>
  );
}
