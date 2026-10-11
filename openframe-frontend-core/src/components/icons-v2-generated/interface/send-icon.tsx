import type { SVGProps } from "react";
export interface SendIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function SendIcon({
    className = "",
    size = 24,
    color = '#1A1A1A',
    ...props
}: SendIconProps) {
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
                d="M11.155 14.449a1.125 1.125 0 1 1-1.59-1.59zm3.961-7.15a1.125 1.125 0 0 1 1.593 1.59l-5.554 5.56-1.59-1.59z"
            />
            <path
                fill={color}
                d="M19.08 1.007c2.322-.693 4.484 1.383 3.97 3.69l-.06.224-4.744 15.953c-.767 2.578-4.204 3.068-5.658.803l-1.793-2.792-3.25.327a2.136 2.136 0 0 1-2.348-2.126v-3.782l-2.891-1.882C.06 9.96.552 6.534 3.122 5.767zM7.447 16.959l3.503-.35.227-.008a1.63 1.63 0 0 1 1.17.567l.137.182 1.998 3.111a.892.892 0 0 0 1.607-.228l4.746-15.954.029-.127a.897.897 0 0 0-1.141-.99L3.765 7.925a.898.898 0 0 0-.233 1.61l3.174 2.068.166.121c.363.308.575.763.575 1.245z"
            />
        </svg>
    );
}
