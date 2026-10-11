import type { SVGProps } from "react";
export interface OpsIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function OpsIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: OpsIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 23 22"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path d="M0 16.125v-12A4.125 4.125 0 0 1 4.125 0h4.586c.494 0 .969.172 1.347.482l.155.14L12.59 3h5.535a4.125 4.125 0 0 1 4.125 4.125v.215a1.125 1.125 0 0 1-2.25 0v-.215c0-1.036-.84-1.875-1.875-1.875h-5.586c-.493 0-.968-.172-1.346-.482l-.157-.14L8.66 2.25H4.125c-1.036 0-1.875.84-1.875 1.875v12C2.25 17.16 3.09 18 4.125 18h6.003l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H4.125A4.125 4.125 0 0 1 0 16.125" />
            <path d="M20 12.625a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.375.375v5.605l1.627-1.446.17-.125a1.125 1.125 0 0 1 1.325.125L20 18.23zm2.25 6.998c0 1.313-1.456 2.05-2.501 1.37l-.204-.156-1.92-1.708-1.92 1.708c-1.049.93-2.704.187-2.705-1.214v-6.998A2.625 2.625 0 0 1 15.625 10h4a2.625 2.625 0 0 1 2.625 2.625z" />
        </svg>
    );
}
