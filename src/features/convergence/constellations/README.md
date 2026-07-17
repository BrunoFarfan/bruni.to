# Constellation geometry

Each constellation is stored as an independent normalized building block. Star
coordinates remain inside a unit square and preserve the source geometry's
aspect ratio, including a small internal margin. Board generation may translate,
rotate, and uniformly scale a definition without changing its recognizable
shape.

The conventional line figures and celestial coordinates are derived from the
D3-Celestial Western constellation dataset:
https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.lines.json

Right ascension is corrected by the cosine of each constellation's mean
declination before normalization. Declination is inverted so smaller y values
appear higher on the game canvas. Star identifiers use familiar proper names
where available and conventional designations otherwise.

D3-Celestial's BSD 3-Clause notice is retained in
`LICENSE-D3-CELESTIAL.txt`.
