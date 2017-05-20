/* global createREGL */

console.clear();

const regl = createREGL();

const drawTriangle = regl({
  vert: `
    precision mediump float;
    attribute vec2 position;
    varying vec3 fcolor;
    void main () {
      fcolor = abs(vec3(position.x, 0, position.y));
      gl_Position = vec4(position, 0, 1);
    }
  `,
  frag: `
    precision mediump float;
    varying vec3 fcolor;
    void main (){
      gl_FragColor = vec4(fcolor, 1);
    }
  `,

  attributes: {
    position: [
      [1, 0],
      [0, 1],
      [-1, -1],
    ],
  },
  count: 3,
});


regl.frame(() => {
  // http://stackoverflow.com/questions/2552676/change-the-color-of-a-vertex-in-a-vertex-shader
  const r = 0.5 * (1 + Math.cos(Date.now() / 1000));
  const g = 0.5 * (1 + Math.sin(Date.now() / 1000));
  const b = 1;
  const a = 1;

  regl.clear({
    color: [r, g, b, a],
    depth: 1,
  });

  drawTriangle();
});
