import type { SVGProps } from "react";
export interface CapsuleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CapsuleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CapsuleIconProps) {
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
        d="M7.52 7.52a1.126 1.126 0 0 1 1.506-.077l.085.077 7.369 7.368.077.087a1.124 1.124 0 0 1-1.583 1.582l-.085-.078L7.52 9.111l-.078-.085A1.126 1.126 0 0 1 7.52 7.52m7.181-2.538a3.25 3.25 0 0 1 4.097 0l.248.222.076.085a1.125 1.125 0 0 1-1.582 1.584l-.085-.078-.157-.127a1 1 0 0 0-1.097 0l-.155.127-.501.501a1.126 1.126 0 0 1-1.59-1.592l.5-.5z"
      />
      <path
        fill={color}
        d="M12.5 2.513a6.364 6.364 0 0 1 8.761 9.224l-9.524 9.524a6.363 6.363 0 0 1-8.999-8.998l9.525-9.525zm7.17 1.816a4.114 4.114 0 0 0-5.504-.281l-.312.281-9.525 9.525a4.114 4.114 0 0 0 5.817 5.816l9.525-9.524a4.114 4.114 0 0 0 0-5.817Z"
      />
    </svg>
  );
}
