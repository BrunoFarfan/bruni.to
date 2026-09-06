# Constellation geometry

Each constellation is stored as an independent normalized building block. The
gameplay definition is a curated skeleton of no more than 15 stars: dense
figures may omit intermediate stars and collapse their line segments while
retaining the recognizable silhouette and principal connections. Coordinates
remain inside a unit square so board generation can translate, rotate, and
scale a definition without rebuilding it.

The conventional line figures and celestial coordinates are derived from the
D3-Celestial Western constellation dataset:
https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.lines.json

The original right ascension was corrected by the cosine of each
constellation's mean declination before normalization. Declination is inverted
so smaller y values appear higher on the game canvas. Curated definitions may
then spread the retained stars within the unit square to improve gameplay
spacing. Star identifiers use familiar proper names where available and
conventional designations otherwise.

D3-Celestial's BSD 3-Clause notice is retained in
`LICENSE-D3-CELESTIAL.txt`.
