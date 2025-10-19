import type { Remix } from "@remix-run/dom";
import { Logo } from "./logo";

export function Layout({ children }: { children: Remix.RemixNode }) {
  return (
    <div
      css={{
        display: "flex",
        flexDirection: "column",
        gap: "58px",
        margin: "6rem auto",
        background: "#2D2D2D",
        color: "white",
        borderRadius: "72px",
        padding: "58px 64px 72px 64px",
      }}
    >
      <header
        css={{
          gridArea: "header",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Logo />
        <div
          css={{
            display: "flex",
            alignItems: "end",
            lineHeight: "0.88",
            textAlign: "right",
            fontSize: "40px",
            fontWeight: 700,
            position: "relative",
            top: "1px",
          }}
        >
          REMIX 3<br />
          DRUM MACHINE Mk III
        </div>
      </header>

      {children}
    </div>
  );
}

export function ControlGroup({ children, css, ...rest }: Remix.Props<"div">) {
  return (
    <div
      {...rest}
      css={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "8rem 8rem",
        gap: "24px",
        alignItems: "stretch",
        justifyContent: "stretch",
        ...css,
      }}
    >
      {children}
    </div>
  );
}

export function Button({ children, ...rest }: Remix.Props<"button">) {
  return (
    <button
      {...rest}
      css={{
        all: "unset",
        letterSpacing: 1.25,
        textAlign: "left",
        paddingLeft: "2rem",
        background: "#666",
        borderRadius: "24px",
        fontSize: "24px",
        fontWeight: 700,
        "&:disabled": {
          opacity: 0.25,
        },
        "&:active": {
          background: "#555",
        },
      }}
    >
      {children}
    </button>
  );
}

export function Triangle({
  label,
  orientation,
}: {
  label: string;
  orientation: "up" | "down";
}) {
  let up = "5,1.34 9.33,8.66 0.67,8.66";
  let down = "5,8.66 9.33,1.34 0.67,1.34";
  return (
    <svg
      aria-label={label}
      viewBox="0 0 10 10"
      css={{
        width: "18px",
        height: "18px",
      }}
    >
      <polygon points={orientation === "up" ? up : down} fill="currentColor" />
    </svg>
  );
}

interface TempoButtonProps extends Remix.Props<"button"> {
  orientation: "up" | "down";
}

export function TempoButton({ orientation, css, ...rest }: TempoButtonProps) {
  return (
    <button
      {...rest}
      css={{
        all: "unset",
        flex: 1,
        background: "#666",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:active": {
          background: "#555",
        },
        ...css,
      }}
    >
      <Triangle label={orientation} orientation={orientation} />
    </button>
  );
}
