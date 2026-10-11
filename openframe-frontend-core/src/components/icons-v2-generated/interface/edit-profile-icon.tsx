import type { SVGProps } from "react";
export interface EditProfileIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function EditProfileIcon({
    className = "",
    size = 24,
    color = '#FAFAFA',
    ...props
}: EditProfileIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path d="M1.875 18V6A4.125 4.125 0 0 1 6 1.877h3a1.125 1.125 0 0 1 0 2.25H6c-1.036 0-1.875.839-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875v-3a1.125 1.125 0 0 1 2.25 0v3A4.125 4.125 0 0 1 18 22.126H6A4.125 4.125 0 0 1 1.875 18M14.832 3.833a1.125 1.125 0 0 1 1.505-.078l.085.078 3.75 3.75.078.085a1.126 1.126 0 0 1-1.584 1.582l-.085-.077-3.75-3.75-.077-.086a1.124 1.124 0 0 1 .078-1.504" />
            <path d="M17.102 1.58a3.126 3.126 0 0 1 4.183.215l.92.92.216.238c1.001 1.228.929 3.038-.215 4.182l-8.395 8.397a4.13 4.13 0 0 1-1.925 1.087l-.315.064-2.17.362A2.125 2.125 0 0 1 6.954 14.6l.362-2.17a4.13 4.13 0 0 1 1.152-2.24l8.396-8.395zm2.592 1.805a.876.876 0 0 0-1.1-.112l-.138.112-8.395 8.397c-.276.276-.46.631-.525 1.017l-.333 1.998 1.999-.333c.385-.064.74-.248 1.017-.524l8.396-8.395a.876.876 0 0 0 .113-1.1l-.113-.138z" />
        </svg>
    );
}
