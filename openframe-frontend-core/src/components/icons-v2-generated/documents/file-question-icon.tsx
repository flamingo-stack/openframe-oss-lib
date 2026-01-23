import type { SVGProps } from "react";
export interface FileQuestionIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileQuestionIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FileQuestionIconProps) {
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
        d="M2.875 19V5A4.125 4.125 0 0 1 7 .875h6.586c.293 0 .58.063.844.177l.022.009q.258.115.48.296l.157.14 5.414 5.415c.18.18.322.39.426.618q.012.022.022.047c.113.262.174.547.174.838V19A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19m12.25-13c0 .484.392.875.875.875h1.285l-2.16-2.16zm-10 13c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875V9.125H16A3.125 3.125 0 0 1 12.876 6V3.125H7c-1.036 0-1.875.84-1.875 1.875z"
      />
      <path
        fill={color}
        d="M12.876 13.01V13a.883.883 0 0 0-.877-.875c-.448 0-.834.311-.93.606a1.125 1.125 0 0 1-2.138-.697c.425-1.307 1.74-2.159 3.069-2.159a3.133 3.133 0 0 1 3.126 3.124v.01c0 1.399-.863 2.192-1.493 2.621a10 10 0 0 1-.529.327 1.125 1.125 0 0 1-2.23-.207v-.3c0-.497.28-.824.42-.964a2.4 2.4 0 0 1 .424-.322c.304-.189.404-.225.65-.393.369-.251.508-.454.508-.761m.499 5.99a1.376 1.376 0 0 1-2.742.14l-.007-.14.007-.141A1.374 1.374 0 0 1 12 17.625l.14.008c.694.07 1.235.655 1.235 1.367"
      />
    </svg>
  );
}
