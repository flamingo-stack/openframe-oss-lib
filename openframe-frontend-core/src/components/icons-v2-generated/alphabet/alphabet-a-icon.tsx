import type { SVGProps } from "react";
export interface AlphabetAIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetAIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetAIconProps) {
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
        d="M9.517 4.647c.808-2.441 4.415-2.36 5.036.245l3.542 14.848.02.113a1.125 1.125 0 0 1-2.176.518l-.033-.11-.986-4.135H9.08l-.986 4.135a1.125 1.125 0 0 1-2.188-.521l3.54-14.848.07-.245Zm2.482.478a.4.4 0 0 0-.234.07.3.3 0 0 0-.104.137l-.026.082-2.019 8.462h4.767l-2.019-8.462c-.03-.126-.083-.185-.129-.219a.4.4 0 0 0-.236-.07"
      />
    </svg>
  );
}
