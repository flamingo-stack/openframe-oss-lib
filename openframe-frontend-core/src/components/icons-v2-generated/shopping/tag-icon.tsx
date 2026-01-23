import type { SVGProps } from "react";
export interface TagIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TagIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TagIconProps) {
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
        d="M20.877 4.22c0-.606-.491-1.097-1.097-1.097h-6.4a2.2 2.2 0 0 0-1.4.5l-.163.147L5.81 9.776l8.411 8.413 6.009-6.008a2.2 2.2 0 0 0 .646-1.561zM3.775 11.814a2.21 2.21 0 0 0 0 3.124l5.286 5.288.169.151a2.21 2.21 0 0 0 2.956-.15l.445-.448-8.41-8.412zm19.352-1.194c0 1.182-.47 2.316-1.305 3.152l-6.763 6.762q-.019.022-.039.044l-.046.042-1.197 1.197a4.46 4.46 0 0 1-6.14.158l-.166-.158-5.287-5.288a4.46 4.46 0 0 1 0-6.306l8.043-8.044.329-.297A4.46 4.46 0 0 1 13.38.872h6.399a3.347 3.347 0 0 1 3.347 3.348z"
      />
      <path
        fill={color}
        d="M18.375 7a1.374 1.374 0 0 1-2.743.141l-.007-.14.007-.141A1.375 1.375 0 0 1 17 5.625l.141.007A1.376 1.376 0 0 1 18.375 7"
      />
    </svg>
  );
}
