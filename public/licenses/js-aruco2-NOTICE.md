# js-aruco2 2.0.0 notice

The chest-marker detector bundles `js-aruco2/src/aruco.js`, its direct
dependency `js-aruco2/src/cv.js`, and
`js-aruco2/src/dictionaries/aruco_4x4_1000.js`. The first two source files
carry MIT headers from Damiano Falcioni and Juan Mellado. The dictionary source
has its own BSD-3-Clause header from OpenCV; the app uses its first 50 codes to
match `DICT_4X4_50`.

The package's full upstream `LICENSE.txt` is retained as
`js-aruco2-LICENSE.txt`. It also documents third-party material used by other
package files. In particular, this application does **not** import the
`posit1.js`, `posit2.js`, or `svd.js` 3D pose helpers; marker distance and 3D
pose estimation are not used here.

The printed set and detector use the `DICT_4X4_50` code subset. Camera frames
are processed locally in a browser Worker.
