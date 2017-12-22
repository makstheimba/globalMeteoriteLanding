require('d3-selection-multi');

const d3 = require('d3');
const versor = require('./versor');
const topojson = require('topojson');

window.onload = () => {
  const canvas = d3.select('canvas');
  const width = canvas.property('width');
  const height = canvas.property('height');
  const context = canvas.node().getContext('2d');

  const projection = d3.geoOrthographic()
    .scale((height - 10) / 2)
    .translate([width / 2, height / 2])
    .precision(0.1);

  const path = d3.geoPath().projection(projection).context(context);

  let render = () => {};
  let v0; // Mouse position in Cartesian coordinates at start of drag gesture.
  let r0; // Projection rotation as Euler angles at start.
  let q0; // Projection rotation as versor at start.

  function dragstarted() {
    v0 = versor.cartesian(projection.invert(d3.mouse(this)));
    r0 = projection.rotate();
    q0 = versor(r0);
  }

  function dragged() {
    const v1 = versor.cartesian(projection.rotate(r0).invert(d3.mouse(this)));
    const q1 = versor.multiply(q0, versor.delta(v0, v1));
    const r1 = versor.rotation(q1);

    projection.rotate(r1);
    render();
  }

  canvas.call(d3.drag().on('start', dragstarted).on('drag', dragged));

  d3.queue()
    .defer(d3.json, 'https://raw.githubusercontent.com/FreeCodeCamp/ProjectReferenceData/master/meteorite-strike-data.json')
    .defer(d3.json, 'https://unpkg.com/world-atlas@1/world/110m.json')
    .await((error, meteors, world) => {
      if (error) throw error;
      const meteorsMass = meteors.features.map(meteor => +meteor.properties.mass).filter(m => m);
      const land = topojson.feature(world, world.objects.land);
      const circle = d3.geoCircle();
      const rScale = d3.scaleSqrt()
        .clamp(true)
        .domain([Math.min(...meteorsMass), Math.max(...meteorsMass)])
        .range([0.1, 5]);

      render = () => {
        context.clearRect(0, 0, width, height);
        context.beginPath();
        path({ type: 'Sphere' });
        context.stroke();
        context.fillStyle = '#bfd7ff';
        context.fill();

        context.beginPath();
        path(land);
        context.fillStyle = '#000';
        context.fill();

        meteors.features.forEach((meteor) => {
          if (meteor.geometry) {
            context.beginPath();
            path(circle.center(meteor.geometry.coordinates).radius(rScale(meteor.properties.mass))());
            context.fillStyle = '#911';
            context.fill();
          }
        });
      };

      render();
    });
};
