/* global window phyllotaxisLayout gridLayout sineLayout spiralLayout createPoints d3 regl */

function main(err, regl) {
  const numPoints = 100000;
  const pointWidth = 4;
  const pointMargin = 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const duration = 1500;
  const delayByIndex = 500 / numPoints;
  const maxDuration = duration + (delayByIndex * numPoints); // include max delay in here

  const toPhyllotaxis = points => phyllotaxisLayout(points, pointWidth + pointMargin, width / 2, height / 2);
  const toGrid = points => gridLayout(points, pointWidth + pointMargin, width);
  const toSine = points => sineLayout(points, pointWidth + pointMargin, width, height);
  const toSpiral = points => spiralLayout(points, pointWidth + pointMargin, width, height);

  const layouts = [toPhyllotaxis, toGrid, toSine, toSpiral];
  let currentLayout = 0;
  let startTime = null; // in seconds
  // start animation loop (note: time is in seconds)
  let frameLoop;

  // wrap d3 color scales so they produce vec3s with values 0-1
  // also limit the t value to remove darkest color
  function wrapColorScale(scale) {
    const tScale = d3.scaleLinear().domain([0, 1]).range([0.4, 1]);
    return (t) => {
      const rgb = d3.rgb(scale(tScale(t)));
      return [rgb.r / 255, rgb.g / 255, rgb.b / 255];
    };
  }

  const colorScales = [
    d3.scaleSequential(d3.interpolateViridis),
    d3.scaleSequential(d3.interpolateMagma),
    d3.scaleSequential(d3.interpolateInferno),
    d3.scaleSequential(d3.interpolateCool),
  ].map(wrapColorScale);
  let currentColorScale = 0;

  // function to compile a draw points regl func
  function createDrawPoints(points) {
    const drawPoints = regl({
      frag: `
      precision highp float;
      varying vec3 fragColor;
      void main() {
        gl_FragColor = vec4(fragColor, 1);
      }
      `,

      vert: `
      attribute vec2 positionStart;
      attribute vec2 positionEnd;
      attribute float index;
      attribute vec3 colorStart;
      attribute vec3 colorEnd;

      varying vec3 fragColor;

      uniform float pointWidth;
      uniform float stageWidth;
      uniform float stageHeight;
      uniform float elapsed;
      uniform float duration;
      uniform float delayByIndex;
      void main() {
        gl_PointSize = pointWidth;

        float delay = delayByIndex * index;
        float t;

        // drawing without animation, so show end state immediately
        if (duration == 0.0) {
          t = 1.0;

        // still delaying before animating
        } else if (elapsed < delay) {
          t = 0.0;
        } else {
          t = 2.0 * ((elapsed - delay) / duration);

          // cubic easing (cubicInOut) -- note there are glslify things for this toPhyllotaxis
          // this is copied from d3.
          t = (t <= 1.0 ? t * t * t : (t -= 2.0) * t * t + 2.0) / 2.0;

          if (t > 1.0) {
            t = 1.0;
          }
        }

        // interpolate position
        float x = mix(positionStart[0], positionEnd[0], t);
        float y = mix(positionStart[1], positionEnd[1], t);

        // interpolate color
        fragColor = mix(colorStart, colorEnd, t);

        // scale to normalized device coordinates (-1, -1) to (1, 1)
        gl_Position = vec4(
          2.0 * ((x / stageWidth) - 0.5),
          // invert y since we think [0,0] is bottom left in pixel space (needed for d3.zoom)
          -(2.0 * ((y / stageHeight) - 0.5)),
          0.0,
          1.0);
      }
      `,

      attributes: {
        positionStart: points.map(d => [d.sx, d.sy]),
        positionEnd: points.map(d => [d.tx, d.ty]),
        colorStart: points.map(d => d.colorStart),
        colorEnd: points.map(d => d.colorEnd),
        index: d3.range(points.length),
      },

      uniforms: {
        pointWidth: regl.prop('pointWidth'),
        stageWidth: regl.prop('stageWidth'),
        stageHeight: regl.prop('stageHeight'),
        delayByIndex: regl.prop('delayByIndex'),
        duration: regl.prop('duration'),

        // time in milliseconds since the prop startTime (i.e. time elapsed)
        elapsed: ({ time }, { startTime = 0 }) => (time - startTime) * 1000,
      },

      count: points.length,
      primitive: 'points',
    });

    return drawPoints;
  }


  function animate(layout, points) {
    console.log('animating with new layout');
    // make previous end the new beginning
    points.forEach((d) => {
      d.sx = d.tx;
      d.sy = d.ty;
      d.colorStart = d.colorEnd;
    });

    // layout points
    layout(points);

    // copy layout x y to end positions
    const colorScale = colorScales[currentColorScale];
    points.forEach((d, i) => {
      d.tx = d.x;
      d.ty = d.y;
      d.colorEnd = colorScale(i / points.length);
    });

    // create the regl function with the new start and end points
    const drawPoints = createDrawPoints(points);

    frameLoop = regl.frame(({ time }) => {
      if (startTime === null) {
        startTime = time;
      }

      regl.clear({
        // background color (black)
        color: [0, 0, 0, 1],
        depth: 1,
      });

      drawPoints({
        pointWidth,
        stageWidth: width,
        stageHeight: height,
        duration,
        delayByIndex,
        startTime,
      });

      if (time - startTime > (maxDuration / 1000)) {
        console.log('done animating, moving to next layout');
        frameLoop.cancel();

        currentLayout = (currentLayout + 1) % layouts.length;
        startTime = null;
        currentColorScale = (currentColorScale + 1) % colorScales.length;
        animate(layouts[currentLayout], points);
      }
    });
  }


  // create initial set of points
  const points = createPoints(numPoints, pointWidth, width, height);
  window.points = points;
  points.forEach((d, i) => {
    d.tx = width / 2;
    d.ty = height / 2;
    d.colorEnd = colorScales[currentColorScale](i / points.length);
  });

  animate(layouts[currentLayout], points);
}


// initialize regl
regl({
  // enable the texture float extension to store positions in buffers
  extensions: [
    'OES_texture_float',
  ],

  // callback when regl is initialized
  onDone: main,
});
