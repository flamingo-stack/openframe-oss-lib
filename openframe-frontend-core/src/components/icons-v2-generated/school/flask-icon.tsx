import type { SVGProps } from "react";
export interface FlaskIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FlaskIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FlaskIconProps) {
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
        d="m18.14 13.874.114.006a1.126 1.126 0 0 1 0 2.239l-.114.006H5.86a1.125 1.125 0 0 1 0-2.25zM15 7.375l.115.006a1.125 1.125 0 0 1 0 2.238L15 9.625h-2a1.125 1.125 0 0 1 0-2.25zm0-3 .115.006a1.125 1.125 0 0 1 0 2.238L15 6.625h-2a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M13.876 3.125h-3.751v7.184c0 .612-.18 1.21-.515 1.718l-.152.21-5.035 6.414c-.708.902-.066 2.224 1.082 2.224h12.988c1.147 0 1.79-1.322 1.081-2.224l-5.031-6.413a3.13 3.13 0 0 1-.667-1.93zm2.25 7.184c0 .195.065.386.186.54l5.033 6.413c1.867 2.379.172 5.863-2.852 5.863H5.505c-3.025 0-4.72-3.486-2.853-5.864l5.035-6.412a.88.88 0 0 0 .188-.54V3.125H7.5a1.125 1.125 0 0 1 0-2.25h9l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-.375v7.184Z"
      />
    </svg>
  );
}
