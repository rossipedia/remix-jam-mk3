import { connect, createRoot, disconnect, type Remix } from "@remix-run/dom";
import { events } from "@remix-run/events";
import { arrowDown, arrowUp, space } from "@remix-run/events/key";
import { press } from "@remix-run/events/press";
import { Button, ControlGroup, Layout, TempoButton } from "./components.tsx";
import { Drummer, type Instrument } from "./drummer.ts";
import { tempoTap } from "./tempo-event.ts";

function DrumMachine(this: Remix.Handle<Drummer>) {
  let drummer = new Drummer(120);

  events(drummer, [Drummer.change(() => this.update())]);

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

    const barWidth = WIDTH / data.byteLength;
    let x = 0;
    for (let i = 0, l = data.byteLength; i < l; ++i) {
      const volume = (data[i] / 255) * 2.5; // normalize to byte values
      const barHeight = HEIGHT * volume;
      // const r = (volume) * 100;
      // const g = 100 - volume;
      drawing.fillStyle = `rgb(${volume * 100} ${100 - volume * 2.5} 0)`;

      drawing.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight);
      x += barWidth + 1;
    }
  }

  return (
    <div
      css={{
        // display: "flex",
        background: "black",
        borderRadius: "24px",
        padding: "24px",
        height: 452,
        // gap: "4px",
      }}
    >
      <canvas
        on={[
          connect((event) => {
            canvas = event.currentTarget;
            drawing = canvas.getContext("2d", {})!;
            render();
          }),
          disconnect(() => {
            cancelAnimationFrame(pendingRender);
          }),
        ]}
        width="804"
        height="404"
      />
    </div>
  );
}

function DrumControls(this: Remix.Handle) {
  let drummer = this.context.get(DrumMachine);
  let stop: HTMLButtonElement;
  let play: HTMLButtonElement;

  events(drummer, [Drummer.change(() => this.update())]);

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
        disabled={drummer.isPlaying}
        on={[
          connect((event) => (play = event.currentTarget)),
          press((event) => {
            drummer.play();
            this.queueTask(() => {
              stop.focus();
            });
          }),
        ]}
      >
        PLAY
      </Button>
      <Button
        disabled={!drummer.isPlaying}
        on={[
          connect((event) => (stop = event.currentTarget)),
          press(() => {
            drummer.stop();
            this.queueTask(() => {
              play.focus();
            });
          }),
        ]}
      >
        STOP
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
        alignItems: "flex-end",
        height: 160,
      }}
    >
      <div
        css={{
          height: "100%",
          display: "flex",
          flex: 1,
          background: "#0B1B05",
          color: "#64C146",
          padding: "42px",
          borderTopLeftRadius: "24px",
          borderBottomLeftRadius: "24px",
          alignItems: "end",
        }}
      >
        <div
          css={{
            fontSize: "24px",
            fontWeight: 700,
            width: "33%",
          }}
        >
          BPM
        </div>
        <div
          css={{
            flex: 1,
            fontSize: "92px",
            fontWeight: 700,
            position: "relative",
            top: 22,
            textAlign: "right",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {drummer.bpm}
        </div>
      </div>
      <div
        css={{
          width: 75,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "100%",
          justifyContent: "space-between",
        }}
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
  return (
    <div
      css={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        fontSize: "180%",
        fontWeight: "bold",
      }}
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
          },
          "& button.off": {
            backgroundColor: "white",
            opacity: 0.2,
          },
          "& button.on": {
            backgroundColor: "rgb(0 255 0)",
            opacity: 0.9,
          },
        }}
      >
        <label>{label}</label>
        {pattern.map((state, note) => (
          <button
            type="button"
            class={state ? "on" : "off"}
            on={[
              press(() => {
                drummer.toggleNote(instrument, note, !state);
              }),
            ]}
          >
            &#x200b;
          </button>
        ))}
      </div>
    );
  };
}

createRoot(document.body).render(<DrumMachine />);
