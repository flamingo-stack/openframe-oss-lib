interface CustomLicenseIconProps {
  className?: string;
  fill?: string;
  width?: number;
  height?: number;
}

export const CustomLicenseIcon = ({ 
  className, 
  fill = "#888888", 
  width = 24, 
  height = 24,
  ...props 
}: CustomLicenseIconProps) => (
  <svg 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    {...props}
  >
    <path 
      d="M12 1C13.3059 1 14.4141 1.83532 14.8262 3H18.5C19.0523 3 19.5 3.44772 19.5 4C19.5 4.55228 19.0523 5 18.5 5H14.8262C14.5249 5.85152 13.8515 6.5238 13 6.8252V21H18.5C19.0523 21 19.5 21.4477 19.5 22C19.5 22.5523 19.0523 23 18.5 23H5.5C4.94772 23 4.5 22.5523 4.5 22C4.5 21.4477 4.94772 21 5.5 21H11V6.8252C10.1485 6.5238 9.47513 5.85152 9.17383 5H5.5C4.94772 5 4.5 4.55228 4.5 4C4.5 3.44772 4.94772 3 5.5 3H9.17383C9.58594 1.83532 10.6941 1 12 1ZM12 3C11.4477 3 11 3.44772 11 4C11 4.55228 11.4477 5 12 5C12.5523 5 13 4.55228 13 4C13 3.44772 12.5523 3 12 3Z" 
      fill={fill} 
    />
  </svg>
) 
