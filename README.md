## Remix Jam Drum Machine - Mark III

Updated version of [`remix-jam-mk2`](https://github.com/rossipedia/remix-jam-mk2):

- Perf improvements on rendering the spectrum analyzer. Now each bar uses the same gradient scale from green->yellow->red. Also, instead of drawing each one with a different fillStyle, an offscreen canvas is used to generate the gradient once, and each bar is copied from that canvas, which should save on some CPU cycles

- Audio consistency improvements. The previous method of generating the sounds Just-In-Time created some odd LFO (low frequency oscillation) artifacts where each hit would have some odd harmonics/overtones and vary in overall volume.
  Now, when the audio context is created, I render the generated sounds to `AudioBuffer` instances, and just re-use those for each hit. This makes the drum machine a bit more like a traditional sampler and less like a synthesizer.

- Unified PLAY and STOP buttons into a single button that toggles state, and added a RESET button where STOP used to be.

- Added support for adjustible volumes in the pattern editor, from 0-100. Default volume is 80.

  - From volume 0-80, volume level is reflected in opacity
  - From volume 80-100, volume level is reflected in color (green->yellow-red)

  - When using the keyboard to edit the pattern, you can use `Shift+Up` and `Shift+Down` to edit the focused button's volume

  - When using the mouse to edit the pattern, you can use `Shift+Scroll` to edit the volume of the note under the mouse cursor.

- Debounced the URL update to avoid spamming the document with navigation events when performing rapid volume updates

### Breaking changes from Mk2

The URL state format has changed, since now I'm no longer just encoding on/off states, but volume levels per note. So instead of a binary string, it's a base64URL encoded string

Have fun, make some noise!

```
npm install
npm start
```

We think we could go pretty big and we're willing to put in the work.
