import React from "react";

interface SpinnerProps {
  size?: "small" | "medium" | "large";
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = "medium", className = "" }) => {
  const dimension = size === "small" ? 16 : size === "large" ? 48 : 32;

  return (
    <div className={`ui-spinner ui-spinner-${size} ${className}`} style={{ display: "inline-flex" }}>
      <svg
        width={dimension}
        height={dimension}
        viewBox="0 0 38 38"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
      >
        <g fill="none" fillRule="evenodd">
          <g transform="translate(1 1)" strokeWidth="3">
            <circle strokeOpacity=".25" cx="18" cy="18" r="18" />
            <path d="M36 18c0-9.94-8.06-18-18-18">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 18 18"
                to="360 18 18"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        </g>
      </svg>
    </div>
  );
};
