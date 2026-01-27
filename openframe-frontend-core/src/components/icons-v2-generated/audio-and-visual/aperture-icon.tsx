import type { SVGProps } from "react";
export interface ApertureIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ApertureIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ApertureIconProps) {
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
        d="M12.68 1.573a1.125 1.125 0 0 1 1.948 1.125l-2.7 4.676h9.443a1.126 1.126 0 0 1 0 2.25H15.97l.146.255 4.573 7.92.053.103a1.127 1.127 0 0 1-1.94 1.12l-.06-.097-2.702-4.676-.26.455-4.46 7.723a1.126 1.126 0 0 1-1.948-1.125l2.7-4.677H2.629a1.125 1.125 0 0 1 0-2.25H8.03L3.31 6.199l-.052-.102a1.125 1.125 0 0 1 1.94-1.12l.06.097 2.7 4.676 4.723-8.176Zm-1.661 8.06a.88.88 0 0 0-.638.419l-.871 1.51-.051.104a.88.88 0 0 0 .05.77l.867 1.5.065.097c.165.214.42.342.693.342h1.732a.88.88 0 0 0 .693-.342l.064-.096.866-1.5a.88.88 0 0 0 .001-.875l-.325-.56-.542-.94-.064-.096a.88.88 0 0 0-.578-.333l-.115-.009h-1.732z"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
