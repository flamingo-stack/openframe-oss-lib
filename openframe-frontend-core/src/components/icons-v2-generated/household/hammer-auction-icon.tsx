import type { SVGProps } from "react";
export interface HammerAuctionIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HammerAuctionIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HammerAuctionIconProps) {
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
        d="M9.979 10.56c.304.03.584.181.774.42a13.9 13.9 0 0 0 2.266 2.267 1.126 1.126 0 0 1 .155 1.614L7.16 21.875a3.57 3.57 0 0 1-4.951.457l-.288-.258a3.57 3.57 0 0 1 .2-5.237l7.016-6.012.091-.07c.218-.151.484-.22.75-.195Zm-6.393 7.985a1.32 1.32 0 0 0-.073 1.938l.107.095c.55.444 1.363.38 1.833-.168l5.279-6.16a16 16 0 0 1-.986-.986z"
      />
      <path
        fill={color}
        d="M11.205 1.205a1.125 1.125 0 1 1 1.59 1.59l-.033.033a16.13 16.13 0 0 1 8.41 8.41l.033-.033a1.125 1.125 0 1 1 1.59 1.59l-6 6a1.125 1.125 0 0 1-1.59-1.59l.032-.034a16.12 16.12 0 0 1-8.41-8.41l-.032.034a1.125 1.125 0 1 1-1.59-1.59zM8.559 7.03l.098.26a13.88 13.88 0 0 0 8.054 8.052l.258.098 2.471-2.471-.098-.258a13.88 13.88 0 0 0-8.052-8.054l-.26-.098L8.56 7.03Z"
      />
    </svg>
  );
}
