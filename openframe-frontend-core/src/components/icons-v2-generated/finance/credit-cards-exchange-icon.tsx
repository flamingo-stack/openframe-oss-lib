import type { SVGProps } from "react";
export interface CreditCardsExchangeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CreditCardsExchangeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CreditCardsExchangeIconProps) {
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
        d="M20.875 17.125h-9.75V20c0 .483.392.875.876.875H20a.874.874 0 0 0 .875-.875zM12.875 4a.875.875 0 0 0-.874-.875H4A.875.875 0 0 0 3.125 4v.375h9.75zm8 10.5a.875.875 0 0 0-.875-.875h-8a.876.876 0 0 0-.876.874v.375h9.75zm2.25 5.5A3.124 3.124 0 0 1 20 23.125h-8A3.125 3.125 0 0 1 8.876 20v-5.5c0-1.726 1.4-3.125 3.126-3.125H20a3.125 3.125 0 0 1 3.125 3.124zm-8-11.5a1.125 1.125 0 0 1-2.25 0V6.625h-9.75V9.5c0 .483.391.874.875.874h2.797l.115.006a1.126 1.126 0 0 1 0 2.239l-.115.005H4A3.125 3.125 0 0 1 .875 9.5V4A3.125 3.125 0 0 1 4 .875h8A3.125 3.125 0 0 1 15.126 4zM.875 18v-2.847a1.126 1.126 0 0 1 1.92-.796l2 2 .078.085a1.125 1.125 0 0 1-1.582 1.583l-.087-.077-.079-.08v.133A2.875 2.875 0 0 0 6 20.873h.35l.113.006a1.126 1.126 0 0 1 0 2.239l-.114.006H6A5.125 5.125 0 0 1 .875 18m18.33-11.948a1.125 1.125 0 0 1 1.505-.076l.085.076.08.079V6A2.875 2.875 0 0 0 18 3.124h-.348a1.125 1.125 0 1 1 0-2.25H18A5.125 5.125 0 0 1 23.125 6v2.848a1.124 1.124 0 0 1-1.92.796l-2-2.001-.078-.085a1.126 1.126 0 0 1 .078-1.506"
      />
    </svg>
  );
}
