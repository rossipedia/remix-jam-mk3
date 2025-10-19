import { connect, createRoot, disconnect, type Remix } from "@remix-run/dom";
import { dom, events } from "@remix-run/events";
import {
  arrowDown,
  arrowLeft,
  arrowRight,
  arrowUp,
  escape,
  space,
} from "@remix-run/events/key";
import { press } from "@remix-run/events/press";
import { Button, ControlGroup, Layout, TempoButton } from "./components.tsx";
import { Drummer, type Instrument } from "./drummer.ts";
import { tempoTap } from "./tempo-event.ts";
import { debounce } from "es-toolkit/function";

function DrumMachine(this: Remix.Handle<Drummer>) {
  // Load from URL
  const searchParams = new URLSearchParams(window.location.search);
  let initialBpm = parseFloat(searchParams.get("bpm") || "120");
  let drummer = new Drummer(initialBpm);

  let initialPatterns = searchParams.get("patterns");
  if (initialPatterns) {
    drummer.deserialize(initialPatterns);
  }

  const updateUrl = debounce(
    () => {
      window.history.replaceState(
        {},
        "",
        `?${new URLSearchParams({
          bpm: String(drummer.bpm),
          patterns: drummer.serialize(),
        })}`
      );
    },
    250,
  );

  events(drummer, [
    Drummer.change(async () => {
      this.update();
      updateUrl();
    }),
  ]);

  // update the URL when the component is mounted to clear out any bad url state
  this.queueTask(async () => {
    updateUrl();
  });

  events(document, [
    space(() => {
      drummer.toggle();
    }),
    arrowUp(() => {
      drummer.setTempo(drummer.bpm + 1);
    }),
    arrowDown(() => {
      drummer.setTempo(drummer.bpm - 1);
    }),
    arrowLeft(() => {
      drummer.setTempo(drummer.bpm - 1);
    }),
    arrowRight(() => {
      drummer.setTempo(drummer.bpm + 1);
    }),
  ]);

  this.context.set(drummer);

  return () => (
    <Layout>
      <Analyzer />
      <DrumControls />
      <Patterns />
    </Layout>
  );
}

export function Analyzer(this: Remix.Handle) {
  let drummer = this.context.get(DrumMachine);

  let canvas: HTMLCanvasElement;
  let drawing: CanvasRenderingContext2D;

  let gradientRect: OffscreenCanvas;

  function initCanvas() {
    drawing = canvas.getContext("2d", {})!;
    const { width: WIDTH, height: HEIGHT } = canvas;

    // Create our gradient in an offscreen canvas so we can blit
    // from it
    gradientRect = new OffscreenCanvas(WIDTH, HEIGHT);
    const context = gradientRect.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    /**
     * 0deg = red
     * 60deg = yellow
     * 120deg = green
     */
    gradient.addColorStop(0.0, "hwb(0deg 0% 0%)"); // red
    gradient.addColorStop(0.3, "hwb(45deg 0% 0%)"); // red
    gradient.addColorStop(1.0, "hwb(120deg 0% 0%)"); // green

    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }

  let pendingRender: number;
  function render() {
    pendingRender = requestAnimationFrame(render);

    const { width: WIDTH, height: HEIGHT } = canvas;

    drawing.clearRect(0, 0, WIDTH, HEIGHT);

    // Get frequency data
    const data = drummer.analyze();
    if (!data) {
      return;
    }

    // subtract byteLength - 1 because we're puttin a pixel of space between
    // each band
    const barWidth = (WIDTH - (data.byteLength - 1)) / data.byteLength;
    let x = 0;
    for (let i = 0, l = data.byteLength; i < l; ++i) {
      const volume = data[i] / 255; // normalize to byte values
      const barHeight = Math.round(HEIGHT * volume);
      const y = HEIGHT - barHeight;
      drawing.drawImage(
        gradientRect,
        x,
        y,
        barWidth,
        barHeight,
        x,
        y,
        barWidth,
        barHeight
      );
      x += barWidth + 1; // <- extra pixel
    }
  }

  return (
    <div
      css={{
        gridArea: "spec",
        background: "black",
        borderRadius: "24px",
        padding: "24px",
        height: "452px",
      }}
    >
      <canvas
        on={[
          connect((event) => {
            canvas = event.currentTarget;
            initCanvas();
            render();
          }),
          disconnect(() => {
            cancelAnimationFrame(pendingRender);
          }),
        ]}
        width="814"
        height="404"
      />
    </div>
  );
}

function DrumControls(this: Remix.Handle) {
  let drummer = this.context.get(DrumMachine);

  return () => (
    <ControlGroup
      css={{
        "& button:focus-visible": {
          outline: "2px solid #2684FF",
          outlineOffset: "2px",
        },
      }}
    >
      <Button
        css={{ display: "grid", placeContent: "center" }}
        on={[
          tempoTap((event) => {
            drummer.play(event.detail);
          }),
        ]}
      >
        SET TEMPO
      </Button>
      <TempoDisplay />
      <Button
        on={[
          dom.click(() => {
            drummer.toggle();
          }),
        ]}
      >
        {drummer.isPlaying ? "STOP" : "PLAY"}
      </Button>
      <Button
        on={[
          press(() => {
            drummer.reset();
          }),
        ]}
      >
        RESET
      </Button>
    </ControlGroup>
  );
}

function TempoDisplay(this: Remix.Handle) {
  let drummer = this.context.get(DrumMachine);
  return () => (
    <div
      css={{
        display: "flex",
        flexDirection: "row",
        gap: "10px",
        alignItems: "center",
      }}
    >
      <div
        css={{
          display: "flex",
          height: "100%",
          flex: 1,
          background: "#0B1B05",
          color: "#64C146",
          borderTopLeftRadius: "24px",
          borderBottomLeftRadius: "24px",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          css={{
            display: "flex",
            alignItems: "baseline",
            gap: "2rem",
          }}
        >
          <div
            css={{
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            BPM
          </div>
          <div
            css={{
              // flex: 1,
              fontSize: "72px",
              fontWeight: 700,
              // position: "relative",
              // top: "22px",
              textAlign: "right",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {drummer.bpm}
          </div>
        </div>
      </div>
      <div
        css={{
          width: "75px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "100%",
          justifyContent: "space-between",
        }}
        // prevent the space bar from playing/stopping the drum machine
        on={space((event) => {
          event.preventDefault();
          event.stopPropagation();
        })}
      >
        <TempoButton
          css={{ borderTopRightRadius: "24px" }}
          orientation="up"
          on={press(() => {
            drummer.setTempo(drummer.bpm + 1);
          })}
        />
        <TempoButton
          css={{ borderBottomRightRadius: "24px" }}
          orientation="down"
          on={press(() => {
            drummer.setTempo(drummer.bpm - 1);
          })}
        />
      </div>
    </div>
  );
}

function Patterns(this: Remix.Handle) {
  let trackButtons: NodeListOf<HTMLButtonElement>;
  let focusedTrack: number = -1;

  let focusTrack = (track: number) => {
    trackButtons[track].focus();
    focusedTrack = track;
  };

  return () => (
    <div
      css={{
        gridArea: "pat",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        fontSize: "180%",
        fontWeight: "bold",
      }}
      tabIndex={0}
      on={[
        connect((event) => {
          trackButtons = event.currentTarget.querySelectorAll("button");
        }),
        escape((event) => {
          event.currentTarget.focus();
        }),
        space((event) => {
          event.stopPropagation();
        }),
        arrowLeft((event) => {
          event.stopPropagation();
          if (focusedTrack === null) return;
          focusTrack((focusedTrack - 1) % trackButtons.length);
        }),
        arrowRight((event) => {
          event.stopPropagation();
          if (focusedTrack === null) return;
          focusTrack((focusedTrack + 1) % trackButtons.length);
        }),
        arrowUp((event) => {
          event.stopPropagation();
          if (focusedTrack === null) return;
          focusTrack(
            (focusedTrack - trackButtons.length / 3 + trackButtons.length) %
              trackButtons.length
          );
        }),
        arrowDown((event) => {
          event.stopPropagation();
          if (focusedTrack === null) return;
          focusTrack(
            (focusedTrack + trackButtons.length / 3) % trackButtons.length
          );
        }),
      ]}
    >
      <Track label="Hat" instrument="hihat" />
      <Track label="Snare" instrument="snare" />
      <Track label="Kick" instrument="kicks" />
    </div>
  );
}

function Track(
  this: Remix.Handle,
  { label, instrument }: { label: string; instrument: Instrument }
) {
  const drummer = this.context.get(DrumMachine);
  return () => {
    const pattern = drummer.getTrack(instrument);
    return (
      <div
        css={{
          display: "grid",
          gridTemplateColumns: `2fr repeat(${pattern.length}, 1fr)`,
          gridAutoRows: "auto",
          gap: "8px",

          "& button": {
            border: "none",
            borderRadius: "2px",
            cursor: "pointer",
            userSelect: "none",
          },
          "& button:focus-visible": {
            outline: "2px solid rgb(0 255 0)",
            outlineOffset: "2px",
          },
        }}
      >
        <label>{label}</label>
        {pattern.map((volume, note) => {
          let buttonHue = "120"; // green
          let opacity = (volume / 80) * 0.5 + 0.4;
          if (volume > 80) {
            // move back towards hue 0 (red)
            buttonHue = String(120 - ((volume - 80) / 20) * 120);
          }
          return (
            <button
              type="button"
              style={
                volume
                  ? {
                      backgroundColor: `hwb(${buttonHue}deg 0% 0% / ${opacity})`,
                    }
                  : { backgroundColor: `hwb(0 100% 0% / 0.2)` }
              }
              title={`Volume: ${volume}`}
              on={[
                dom.click(() => {
                  drummer.toggleNote(instrument, note, !volume);
                }),
                dom.wheel((e: WheelEvent) => {
                  if (e.shiftKey) {
                    e.preventDefault();

                    drummer.adjustNoteVolume(
                      instrument,
                      note,
                      e.deltaX < 0 ? -1 : 1
                    );
                  }
                }),
                arrowUp((e) => {
                  if (e.detail.originalEvent.shiftKey) {
                    e.stopPropagation();
                    drummer.adjustNoteVolume(instrument, note, 1);
                  }
                }),
                arrowDown((e) => {
                  if (e.detail.originalEvent.shiftKey) {
                    e.stopPropagation();
                    drummer.adjustNoteVolume(instrument, note, -1);
                  }
                }),
              ]}
              tabIndex={-1}
            >
              {/* &#x200b; */}
              {volume}
            </button>
          );
        })}
      </div>
    );
  };
}

createRoot(document.body).render(<DrumMachine />);
