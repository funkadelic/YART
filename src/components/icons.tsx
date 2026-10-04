import type { ReactNode, SVGProps } from "react";

interface IconProps {
  readonly className?: SVGProps<SVGSVGElement>["className"];
}

/** The shared svg root: one em square, stroked in the current text color, hidden from assistive technology. */
function Icon({
  children,
  ...props
}: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** The search box's leading glyph, a magnifying glass. */
export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5l5 5" />
    </Icon>
  );
}

/** Marks a column sorted ascending. */
export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 14.5l5-5 5 5" />
    </Icon>
  );
}

/** Marks a column sorted descending. */
export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 9.5l5 5 5-5" />
    </Icon>
  );
}

/** The previous-page control. */
export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 7l-5 5 5 5" />
    </Icon>
  );
}

/** The next-page control. */
export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 7l5 5-5 5" />
    </Icon>
  );
}

/** The first-page control, a chevron against a bar. */
export function FirstPageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 6v12" />
      <path d="M17 7l-5 5 5 5" />
    </Icon>
  );
}

/** The last-page control, a chevron against a bar. */
export function LastPageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 6v12" />
      <path d="M7 7l5 5-5 5" />
    </Icon>
  );
}
