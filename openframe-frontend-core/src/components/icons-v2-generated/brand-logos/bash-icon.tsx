import type { SVGProps } from "react";
export interface BashIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function BashIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: BashIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill={color}
                d="M5 9h2.31l.32-3h2l-.32 3h2l.32-3h2l-.32 3H15v2h-1.9l-.2 2H15v2h-2.31l-.32 3h-2l.32-3h-2l-.32 3h-2l.32-3H5v-2h1.9l.2-2H5zm4.1 2-.2 2h2l.2-2M19 6h-2v8h2m0 2h-2v2h2Z"
            />
        </svg>
    );
}
