import type { SVGProps } from "react";
export interface NocIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function NocIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: NocIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 23 21"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path d="M10 15.125a1.125 1.125 0 0 1 2.25 0V18h2.874l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H7.126a1.125 1.125 0 0 1 0-2.25h2.876z" />
            <path d="M20 4.125c0-1.036-.84-1.875-1.875-1.875h-14c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.874 1.875 1.874h14C19.16 14 20 13.16 20 12.125zm2.25 8a4.125 4.125 0 0 1-4.125 4.125h-14A4.125 4.125 0 0 1 0 12.124V4.126A4.125 4.125 0 0 1 4.125 0h14a4.125 4.125 0 0 1 4.125 4.125z" />
        </svg>
    );
}
