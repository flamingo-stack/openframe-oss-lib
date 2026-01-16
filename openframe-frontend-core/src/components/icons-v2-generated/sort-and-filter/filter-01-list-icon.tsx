import type { SVGProps } from "react";
export interface Filter01ListIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Filter01ListIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Filter01ListIconProps) {
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
        d="m22 18.875.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005h-6a1.125 1.125 0 0 1 0-2.25zm0-5 .116.005a1.126 1.126 0 0 1 0 2.239l-.116.006h-6a1.125 1.125 0 0 1 0-2.25zm0-5a1.125 1.125 0 0 1 0 2.25h-4a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M12.933 19.997c0 1.548-1.583 2.541-2.948 1.96l-.27-.138-2.607-1.563a2.13 2.13 0 0 1-1.033-1.822v-7.011L1.53 6.229C.045 4.53 1.25 1.875 3.506 1.875h11.997c2.255 0 3.46 2.656 1.974 4.354l-4.544 5.19zm-4.608-1.635 2.358 1.413v-8.399c0-.515.187-1.012.526-1.399l4.575-5.23.063-.096a.376.376 0 0 0-.344-.526H3.506a.376.376 0 0 0-.283.623l4.576 5.229.12.15c.263.361.406.799.406 1.249z"
      />
    </svg>
  );
}
