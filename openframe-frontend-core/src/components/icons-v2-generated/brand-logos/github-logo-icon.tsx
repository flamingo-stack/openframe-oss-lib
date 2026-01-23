import type { SVGProps } from "react";
export interface GithubLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GithubLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GithubLogoIconProps) {
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
        d="M12 2A10.25 10.25 0 0 0 1.747 12.253c0 4.537 2.935 8.369 7.01 9.727.513.09.705-.218.705-.487 0-.243-.012-1.05-.012-1.91-2.576.475-3.243-.627-3.448-1.204-.115-.295-.615-1.205-1.05-1.448-.36-.192-.872-.667-.014-.68.808-.012 1.384.744 1.577 1.051.922 1.551 2.396 1.116 2.986.846.09-.666.359-1.115.654-1.371-2.282-.256-4.666-1.14-4.666-5.062 0-1.115.398-2.038 1.051-2.756-.102-.256-.461-1.307.103-2.717 0 0 .859-.269 2.82 1.051a9.5 9.5 0 0 1 2.563-.346c.871 0 1.743.115 2.563.346 1.96-1.333 2.82-1.05 2.82-1.05.563 1.409.204 2.46.102 2.716.654.718 1.05 1.628 1.05 2.756 0 3.934-2.396 4.806-4.677 5.062.372.32.692.936.692 1.897 0 1.371-.013 2.473-.013 2.82 0 .268.192.589.705.486a10.27 10.27 0 0 0 6.985-9.727A10.25 10.25 0 0 0 12 2"
      />
    </svg>
  );
}
