/**
 * Tiny hand-made network in Overpass JSON shape (NOT real OSM data), used only for tests.
 *
 *   1 --- 2 --- 3        row 0: primary, two-way
 *   |     ^     |        col 1: tertiary, oneway=-1 (travel 8 -> 5 -> 2)
 *   4 --> 5 --> 6        row 1: secondary, oneway=yes (eastbound only)
 *   |     ^     |
 *   7 --- 8 --- 9 -> 40  row 2: residential, maxspeed 20; 9 -> 40 is a one-way dead-end spur
 *
 * Extra cases: node 20 is a curve point on 1-4; way 9 (nodes 30,31) CROSSES rows 0 and 1 without
 * sharing a node (must not connect); way 11 is access=private; way 12 is a footway.
 */
const lat = { r0: 26.85, r1: 26.855, r2: 26.86 };
const lon = { c0: 80.95, c1: 80.955, c2: 80.96 };
const node = (id, la, lo) => ({ type: 'node', id, lat: la, lon: lo });

export const osmFixture = {
  version: 0.6,
  elements: [
    node(1, lat.r0, lon.c0), node(2, lat.r0, lon.c1), node(3, lat.r0, lon.c2),
    node(4, lat.r1, lon.c0), node(5, lat.r1, lon.c1), node(6, lat.r1, lon.c2),
    node(7, lat.r2, lon.c0), node(8, lat.r2, lon.c1), node(9, lat.r2, lon.c2),
    node(20, 26.8525, 80.9515),
    node(30, 26.8475, 80.9525), node(31, 26.8575, 80.9525),
    node(40, 26.865, lon.c2),
    { type: 'way', id: 1, nodes: [1, 2, 3], tags: { highway: 'primary', name: 'Row Zero' } },
    { type: 'way', id: 2, nodes: [4, 5, 6], tags: { highway: 'secondary', oneway: 'yes', name: 'Row One' } },
    { type: 'way', id: 3, nodes: [7, 8, 9], tags: { highway: 'residential', maxspeed: '20', name: 'Row Two' } },
    { type: 'way', id: 4, nodes: [1, 20, 4, 7], tags: { highway: 'residential', name: 'Col Zero' } },
    { type: 'way', id: 5, nodes: [2, 5, 8], tags: { highway: 'tertiary', oneway: '-1', name: 'Col One' } },
    { type: 'way', id: 6, nodes: [3, 6, 9], tags: { highway: 'residential', name: 'Col Two' } },
    { type: 'way', id: 9, nodes: [30, 31], tags: { highway: 'residential', name: 'Crossing Lane' } },
    { type: 'way', id: 10, nodes: [9, 40], tags: { highway: 'residential', oneway: 'yes', name: 'Spur' } },
    { type: 'way', id: 11, nodes: [5, 6], tags: { highway: 'service', access: 'private' } },
    { type: 'way', id: 12, nodes: [4, 5], tags: { highway: 'footway' } },
  ],
};
