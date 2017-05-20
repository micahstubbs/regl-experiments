console.clear()

var regl = createREGL()

var drawTriangle = regl({
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
      [-1, -1]
    ]
  },
  count: 3
})


regl.frame(function () {
  regl.clear({
    color: [0, .5*(1 + Math.cos(Date.now()/2000)), 1, 1],
    depth: 1
  })

  drawTriangle()
})
