import type { Remix } from "@remix-run/dom";
import { Logo } from "./logo";
import type { EventDescriptor } from "@remix-run/events";

export function Layout({ children }: { children: Remix.RemixNode }) {
  return (
    <div
      css={{
        boxSizing: "border-box",
        "& *": {
          boxSizing: "border-box",
        },
        display: "flex",
        flexDirection: "column",
        gap: "58px",
        width: 980,
        margin: "6rem auto",
        background: "#2D2D2D",
        color: "white",
        borderRadius: "72px",
        padding: "58px 64px 72px 64px",
      }}
    >
      <header
        css={{
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
          DRUM MACHINE
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
        gridTemplateRows: "1fr 1fr",
        gap: "24px",
        alignItems: "center",
        justifyContent: "center",
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
        height: 160,
        display: "flex",
        alignItems: "end",
        background: "#666",
        borderRadius: "24px",
        padding: "42px",
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

export type DecayGenerator = Generator<number, number, number>;

export function createExponentialDecayGenerator(
  halfLifeMs: number,
  startValue: number,
  startMs: number
): DecayGenerator {
  const localEpsilon = 0.001;
  function* decay(): Generator<number, number, number> {
    let value = startValue;
    let lastMs = startMs;
    while (value > localEpsilon) {
      const input = yield value;
      const nowMs = typeof input === "number" ? input : performance.now();
      const deltaMs = Math.max(0, nowMs - lastMs);
      lastMs = nowMs;
      const decayFactor = Math.pow(0.5, deltaMs / halfLifeMs);
      value = value * decayFactor;
    }
    return 0;
  }
  return decay();
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
        width: 18,
        height: 18,
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
