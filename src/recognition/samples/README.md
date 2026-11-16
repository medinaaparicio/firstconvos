# Recorded samples

One file per letter (`A.json`, `B.json`, ...), made with the capture tool on
the spike page. Format (see `../samples.ts`):

```json
{ "letter": "A", "hand": "right", "samples": [ [ {"x":0,"y":0,"z":0}, ... 21 points ], ... ] }
```

- Each sample is one 3-second still hold, averaged, after `normalize()`:
  wrist at the origin, wrist-to-middle-finger-base distance = 1.
- Right hand, palm roughly facing the camera, small changes in tilt and
  distance between holds.
- Coordinates are the camera's un-mirrored view (mirroring is display-only).
