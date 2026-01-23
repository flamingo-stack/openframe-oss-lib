import type { SVGProps } from "react";
export interface AlphabetQIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetQIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetQIconProps) {
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
        d="M12.205 15.704a1.124 1.124 0 0 1 1.505-.076l.086.076 1.247 1.247c.21-.44.332-.93.332-1.45V8.5a3.375 3.375 0 1 0-6.75 0v7A3.375 3.375 0 0 0 12 18.876c.52 0 1.011-.122 1.452-.332l-1.247-1.248-.078-.085a1.126 1.126 0 0 1 .078-1.506Zm5.42-.204a5.6 5.6 0 0 1-.933 3.102l.603.603.078.085a1.126 1.126 0 0 1-1.584 1.582l-.084-.076-.604-.604A5.625 5.625 0 0 1 6.375 15.5v-7a5.625 5.625 0 0 1 11.25 0z"
      />
    </svg>
  );
}
