/* global createREGL document window chroma */

const regl = createREGL();

const doc = document.body;
const docWidth = window.innerWidth;
const docHeight = window.innerHeight;
const aspectRatio = docHeight / docWidth;

const colCount = 50;
const colWidth = docWidth / colCount;

const rowCount = parseInt(colCount * aspectRatio, 10);
const rowHeight = docHeight / rowCount;

const circleCount = rowCount * colCount;
const maxRadius = Math.min(colWidth, rowHeight) / 2;

const minScale = 1e-6; // use small number to avoid reaching zero
const maxScale = 2.00;

const remapSin = i => 0.5 + (Math.sin(i) * 0.5);
const remapCos = i => 0.5 + (Math.cos(i) * 0.5);

// sample nine colors from the magma color space
const palette = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0].map(t => d3.interpolateMagma(t));
console.log('palette', palette);

// gl mode uses [r,g,b] vector with normalised values
const paletteGL = palette.map(d => {
  const cGL = d3.color(d).rgb();
  return [cGL.r, cGL.g, cGL.b].map(e => e / 255); 
}); 
console.log('paletteGL', paletteGL);

// const palette = chroma.brewer.PuBu.slice(5, 10);
// const paletteGL = palette.map(c => chroma(c).gl()); // gl mode uses [r,g,b] vector w normalised values

const randomScale = i => minScale + ((maxScale - minScale) * remapCos(i));
const randomColor = i => paletteGL[Math.floor(palette.length * remapSin(i))];

const getGridPoints = (cols, rows, colWidth, rowHeight, gridWidth, gridHeight) => {
  const count = cols * rows;
  const points = new Float32Array(count * 2);

  let col;
  let row;
  let xPos;
  let yPos;
  let xIndex;
  let yIndex;

  for (let i = 0; i < count; i += 1) {
    col = i % cols;
    row = parseInt(i / cols, 10);

    xPos = (col * colWidth) + (colWidth / 2);
    yPos = (row * rowHeight) + (rowHeight / 2);

    xIndex = (2 * i);
    yIndex = xIndex + 1;

    points[xIndex] = ((2 * xPos) / gridWidth) - 1;  // convert to (-1, 1) GL coord space
    points[yIndex] = ((2 * yPos) / gridHeight) - 1; // convert to (-1, 1) GL coord space
  }

  return points;
};

const getAnimStates = (count, done) => {
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  let r;
  let g;
  let b;
  let rIndex;
  let gIndex;
  let bIndex;

  for (let i = 0; i < count; i += 1) {
    [r, g, b] = randomColor(i * done);

    rIndex = (3 * i);
    gIndex = rIndex + 1;
    bIndex = rIndex + 2;

    colors[rIndex] = r;
    colors[gIndex] = g;
    colors[bIndex] = b;

    scales[i] = randomScale(i * done);
  }

  return { colors, scales };
};

// build inputs for our animation:
const centroids = getGridPoints(colCount, rowCount, colWidth, rowHeight, docWidth, docHeight);

// create a series of animation states for each circle
const numStates = 50;
const allStates = [];

while (allStates.length < numStates) {
  allStates.push(getAnimStates(circleCount, allStates.length));
}

// regl command featuring shaders that will draw supplied points
const drawPoints = regl({
  vert: `
  precision highp float;

  uniform float progress; // interpolation progress (from 0.0 to 1.0)
  uniform float maxRadius; // max radius to draw (n.b. point is square of 2*r x 2*r)

  attribute vec2 point; // position at which to draw

  attribute float scaleA; // scale factor A
  attribute float scaleB; // scale factor B

  attribute vec3 colorA; // color A
  attribute vec3 colorB; // color B

  varying vec3 rgb; // interpolated color
  varying float scale; // interpolated scale

  void main () {
    rgb = mix(colorA, colorB, progress);
    scale = mix(scaleA, scaleB, progress);

    gl_PointSize = maxRadius * 2. * scale;
    gl_Position = vec4(point, 0, 1);
  }
  `,

  frag: `
  precision highp float;

  varying vec3 rgb;
  varying float scale;

  void main () {
    // determine normalized distance from center of point
    float point_dist = length(gl_PointCoord * 2. - 1.);

    // calc scale at which to start fading out the circle
    float min_dist = 0.95; //scale * 0.90;

    // calc scale at which we find the edge of the circle
    float max_dist = 1.00;//scale;

    // https://thebookofshaders.com/glossary/?search=smoothstep
    float alpha = 1. - smoothstep(min_dist, max_dist, point_dist);

    gl_FragColor = vec4(rgb, alpha * 0.85);
  }
  `,

  // using textbook example from http://regl.party/api#blending

  depth: {
    enable: false,
  },

  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 'src color',
      dstRGB: 'one',
      dstAlpha: 'one',
      // src: 'one',
      // dst: 'one'
    },
    equation: 'add',
    color: [0, 0, 0, 0],
  },

  attributes: {
    point: centroids,
    colorA: regl.prop('currColors'),
    colorB: regl.prop('nextColors'),
    scaleA: regl.prop('currScales'),
    scaleB: regl.prop('nextScales'),
  },

  uniforms: {
    maxRadius,
    progress: regl.prop('progress'),
  },

  count: circleCount,

  primitive: 'points',

});

// render loop
const fps = 60;
const tweenTime = 6;
const tweenFrames = fps * tweenTime;

let state = 0;

regl.frame(({ tick }) => {
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1,
  });

  // increment frame counter until we reach the desired loop point
  const frame = tick % tweenFrames;

  // increment state counter once we've looped back around
  if (frame === 0) {
    state = (state + 1) % numStates;
    // console.log('state counter', state);
  }

  // track progress as proportion of frames completed
  const progress = frame / tweenFrames;

  // determine current and next state
  const currState = allStates[state];
  const nextState = allStates[(state + 1) % numStates];

  drawPoints({
    currColors: currState.colors,
    currScales: currState.scales,
    nextColors: nextState.colors,
    nextScales: nextState.scales,
    progress,
  });
});
