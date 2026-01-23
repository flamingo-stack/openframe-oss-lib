import type { SVGProps } from "react";
export interface HourglassIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HourglassIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HourglassIconProps) {
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
        d="M4.875 22v-3.343c0-1.36.54-2.663 1.501-3.624l2.415-2.414.11-.138a.88.88 0 0 0 0-.962l-.11-.138-2.415-2.414a5.13 5.13 0 0 1-1.501-3.624V2a1.125 1.125 0 0 1 2.25 0v3.343c0 .762.303 1.494.842 2.033l2.414 2.414a3.125 3.125 0 0 1 0 4.42l-2.414 2.413a2.88 2.88 0 0 0-.842 2.034V22a1.125 1.125 0 0 1-2.25 0m12 0v-3.343c0-.763-.303-1.494-.842-2.034l-2.414-2.414a3.125 3.125 0 0 1 0-4.419l2.414-2.414.192-.211c.419-.511.65-1.155.65-1.822V2a1.125 1.125 0 0 1 2.25 0v3.343c0 1.359-.54 2.663-1.502 3.624L15.21 11.38a.876.876 0 0 0 0 1.238l2.415 2.414a5.13 5.13 0 0 1 1.501 3.624V22a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="m19 20.875.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006H5a1.125 1.125 0 0 1 0-2.25zm0-20 .115.006a1.125 1.125 0 0 1 0 2.238L19 3.125H5a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
