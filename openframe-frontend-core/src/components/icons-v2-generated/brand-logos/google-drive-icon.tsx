import type { SVGProps } from "react";
export interface GoogleDriveIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GoogleDriveIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: GoogleDriveIconProps) {
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
        d="M8.588 2.25a1.125 1.125 0 0 1 1.469.333l.061.099 6.54 11.693H22l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005H8.82l-2.726 4.706a1.124 1.124 0 0 1-1.945-1.128l6.712-11.586L8.154 3.78l-.051-.104a1.125 1.125 0 0 1 .485-1.427Zm1.538 12.125h3.956l-1.944-3.474z"
      />
      <path
        fill={color}
        d="M13.931 1.875c1.116 0 2.147.594 2.706 1.56l6.069 10.493.098.186c.43.875.427 1.903-.01 2.776l-.1.184-2.06 3.508a3.12 3.12 0 0 1-2.694 1.543H6.06a3.13 3.13 0 0 1-2.585-1.368l-.11-.175-2.06-3.508a3.12 3.12 0 0 1-.01-3.146l6.07-10.493.11-.176a3.13 3.13 0 0 1 2.593-1.384zm-3.863 2.25a.88.88 0 0 0-.693.34l-.064.097-6.069 10.492a.88.88 0 0 0 .003.882l2.06 3.507a.88.88 0 0 0 .756.432h11.88c.31 0 .597-.165.754-.432l2.06-3.507a.88.88 0 0 0 .054-.776l-.052-.106-6.069-10.492a.88.88 0 0 0-.757-.437z"
      />
    </svg>
  );
}
