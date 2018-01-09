require('d3-selection-multi');

const d3 = require('d3');
const versor = require('./versor');
const topojson = require('topojson');

const getTooltipHTML = ({ name, mass, year }) => (
  `<strong>${name}</strong><br />${mass || '???'} g<br />Fell in ${new Date(year).getFullYear()}`
);

window.onload = () => {
  let width = 960;
  let height = 600;
  const canvas = d3.select('#mainCanvas').attrs({ width: `${width}px`, height: `${height}px` });
  const context = canvas.node().getContext('2d');
  const tooltip = d3.select('.tooltip');

  let projection = d3.geoOrthographic()
    .scale((height - 10) / 2)
    .translate([width / 2, height / 2])
    .precision(0.1);

  const path = d3.geoPath().projection(projection).context(context);

  const hiddenCanvas = d3.select('#hiddenCanvas').attrs({ width: `${width}px`, height: `${height}px` });
  const hiddenContext = hiddenCanvas.node().getContext('2d');
  const hiddenProjection = d3.geoEquirectangular();
  const hiddenPath = d3.geoPath().projection(hiddenProjection).context(hiddenContext);

  let render = () => {};
  let v0; // Mouse position in Cartesian coordinates at start of drag gesture.
  let r0; // Projection rotation as Euler angles at start.
  let q0; // Projection rotation as versor at start.
  let selectedMeteor = null;

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

  function resize() {
    canvas.attrs({ width: `${width}px`, height: `${height}px` });
    projection = projection
      .scale((height - 10) / 2)
      .translate([width / 2, height / 2]);
    render();
  }

  canvas.call(d3.drag().on('start', dragstarted).on('drag', dragged));
  d3.select('#zoomIn').on('click', () => {
    width += 50;
    height += 50;
    resize();
  });
  d3.select('#zoomOut').on('click', () => {
    width = width < 960 ? width : width - 50;
    height = height < 600 ? height : height - 50;
    resize();
  });

  d3.queue()
    .defer(d3.json, 'https://raw.githubusercontent.com/FreeCodeCamp/ProjectReferenceData/master/meteorite-strike-data.json')
    .defer(d3.json, 'https://unpkg.com/world-atlas@1/world/110m.json')
    .await((error, dirtyMeteors, world) => {
      if (error) throw error;
      const meteorsMass = dirtyMeteors.features.map(meteor => +meteor.properties.mass).filter(m => m);
      const land = topojson.feature(world, world.objects.land);
      const circle = d3.geoCircle().precision(25);
      const rScale = d3.scaleSqrt()
        .clamp(true)
        .domain([Math.min(...meteorsMass), Math.max(...meteorsMass)])
        .range([0.1, 5]);
      const meteors = dirtyMeteors.features
        .filter(meteor => meteor.geometry)
        .map(meteor => Object.assign({ radius: rScale(meteor.properties.mass) }, meteor));
      const drawMeteor = (meteor, isSelected) => {
        if (!meteor.geometry) return;
        context.beginPath();
        path(circle.center(meteor.geometry.coordinates).radius(meteor.radius)());
        context.fillStyle = isSelected ? '#0ad' : '#911';
        context.fill();
      };

      meteors.forEach((meteor, i) => {
        const iStr = `${i}`.padStart(3, 0);

        hiddenContext.beginPath();
        hiddenPath(circle.center(meteor.geometry.coordinates).radius(meteor.radius)());
        hiddenContext.fillStyle = `rgb(${(iStr[0] * 10) + 5}, ${(iStr[1] * 10) + 5}, ${(iStr[2] * 10) + 5})`;
        hiddenContext.fill();
      });

      render = () => {
        context.clearRect(0, 0, width, height);
        context.beginPath();
        path({ type: 'Sphere' });
        context.stroke();
        context.fillStyle = '#bfd7ff';
        context.fill();

        context.beginPath();
        path(land);
        context.fillStyle = '#555';
        context.fill();

        meteors.forEach(meteor => drawMeteor(meteor, false));
      };

      render();

      canvas.on('mousemove', function () {
        const pos = d3.mouse(this);
        const latlong = projection.invert(pos);
        const hiddenPos = hiddenProjection(latlong);
        const p = hiddenPos[0] > -1
          ? hiddenContext.getImageData(hiddenPos[0], hiddenPos[1], 1, 1).data
          : null;

        if (p !== null && p[0] !== 0) {
          const index = (Math.floor(p[0] / 10) * 100) + (Math.floor(p[1] / 10) * 10) + (Math.floor(p[2] / 10));
          const meteor = meteors[index];

          if (index !== selectedMeteor) {
            if (selectedMeteor !== null) {
              drawMeteor(meteors[selectedMeteor], false);
            }
            selectedMeteor = index;
            drawMeteor(meteor, true);
            tooltip.classed('tooltip-hidden', false)
              .html(getTooltipHTML(meteor.properties))
              .styles({ left: `${pos[0]}px`, top: `${pos[1]}px` });
          }
        } else {
          if (selectedMeteor !== null) {
            drawMeteor(meteors[selectedMeteor], false);
          }
          selectedMeteor = null;
          tooltip.classed('tooltip-hidden', true);
        }
      });
    });
};
