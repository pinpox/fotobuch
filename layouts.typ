// ─────────────────────────────────────────────────────────────
// Photobook layout template — 17.8 × 10 cm (16:9)
//
// Usage in your main file:
//   #import "layouts.typ": *
//   #show: book
//   #full("photos/001.jpg")
//   #grid4("photos/002.jpg", "photos/003.jpg",
//          "photos/004.jpg", "photos/005.jpg")
//   #pano("photos/006.jpg")          // emits TWO pages (a spread)
//
// Every function = exactly one page (pano = two).
// ─────────────────────────────────────────────────────────────

// ── Configuration ────────────────────────────────────────────
#let trim-w = 18.7cm            // final page size after cutting
#let trim-h = 10.5cm
#let bleed  = 3mm               // set to 0mm if your printer wants none
#let inner  = 8mm               // whitespace margin (from trim edge)

#let page-w = trim-w + 2 * bleed
#let page-h = trim-h + 2 * bleed
#let m = bleed + inner          // margin measured from the PDF edge

// ── Helpers ──────────────────────────────────────────────────

// cover-crop a photo into a fixed box.
// Accepts a plain path (centered crop) or a dict
// (path: "…", fx: 30%, fy: 50%, ar: 1.778, zoom: 1.4) where fx/fy pick
// the crop window (0% = left/top edge, 100% = right/bottom), ar is the
// photo's width/height ratio and zoom (>= 1) enlarges beyond the
// minimal cover crop. The builder fills ar/zoom in automatically.
#let ph(spec, w, h) = {
  if type(spec) == str { return image(spec, width: w, height: h, fit: "cover") }
  let ar = spec.at("ar", default: none)
  if ar == none { return image(spec.path, width: w, height: h, fit: "cover") }
  let fx = spec.at("fx", default: 50%)
  let fy = spec.at("fy", default: 50%)
  let z = spec.at("zoom", default: 1)
  let iw = z * (if ar > w / h { h * ar } else { w })
  let ih = z * (if ar > w / h { h } else { w / ar })
  // Lay the photo out small enough to fit the box (some layout contexts
  // shrink oversized images), then blow it up with a drawing-only scale
  // that layout cannot clamp.
  let bw = calc.min(w, h * ar)
  let f = iw / bw
  box(width: w, height: h, clip: true, align(top + left, scale(
    x: f * 100%, y: f * 100%, origin: top + left, reflow: false,
    move(
      dx: -(iw - w) * (fx / 100%) / f,
      dy: -(ih - h) * (fy / 100%) / f,
      image(spec.path, width: bw, height: bw / ar)))))
}

// caption style — change once, applies everywhere
#let cap(body) = text(size: 7.5pt, fill: luma(80%), tracking: 0.4pt, body)

// uncropped photo at a fixed height; width follows the photo's aspect.
// A dict spec with zoom > 1 crops inside the photo's own frame, so the
// footprint on the page stays the same as the uncropped photo.
#let phu(spec, h) = {
  if type(spec) == str { return image(spec, height: h) }
  let ar = spec.at("ar", default: none)
  if ar == none or spec.at("zoom", default: 1) == 1 {
    return image(spec.path, height: h)
  }
  ph(spec, h * ar, h)
}

// apply to the whole document via `#show: book`
#let book(body) = {
  set page(width: page-w, height: page-h, margin: 0pt, fill: black)
  set text(size: 8pt)
  body
}

// ── Layouts ──────────────────────────────────────────────────

// 1 │ Full bleed — photo covers the entire page, zero crop
#let full(img) = page(
  place(top + left, ph(img, page-w, page-h))
)

// 2 │ 2×2 grid — four photos, each still ~16:9
#let grid4(a, b, c, d, gap: 2mm) = page({
  let cw = (page-w - gap) / 2
  let ch = (page-h - gap) / 2
  place(top + left, grid(
    columns: (cw, cw), rows: (ch, ch),
    column-gutter: gap, row-gutter: gap,
    ph(a, cw, ch), ph(b, cw, ch),
    ph(c, cw, ch), ph(d, cw, ch),
  ))
})

// 3 │ Half-size photo top-left + whitespace, optional caption bottom-left
#let half(img, caption: none) = page({
  let w = trim-w / 2
  place(top + left, dx: m, dy: m, ph(img, w, w * 9 / 16))
  if caption != none {
    place(bottom + left, dx: m, dy: -m, cap(caption))
  }
})

// 4 │ Two photos side by side, vertically centered, optional caption
#let duo(a, b, gap: 4mm, caption: none) = page({
  let w = (trim-w - 2 * inner - gap) / 2
  let h = w * 9 / 16
  place(center + horizon, grid(
    columns: (w, w), column-gutter: gap,
    ph(a, w, h), ph(b, w, h),
  ))
  if caption != none {
    place(bottom + center, dy: -m, cap(caption))
  }
})

// 4b │ Portrait pair — two uncropped portrait photos on a black page,
//      side by side with a slim black border above and below;
//      width follows each photo's aspect
#let duo-portrait(a, b, gap: 8mm, border: 4mm) = page(
  place(center + horizon, stack(dir: ltr, spacing: gap,
    phu(a, trim-h - 2 * border), phu(b, trim-h - 2 * border)))
)

// 4c │ Single portrait — one uncropped portrait photo centered on a
//      black page, slim black border above and below
#let solo-portrait(img, border: 4mm) = page(
  place(center + horizon, phu(img, trim-h - 2 * border))
)

// 5 │ One large photo bleeding off the top-left + small photo bottom-right
#let big-small(big, small) = page({
  let bw = page-w * 0.66
  let sw = 4.4cm
  place(top + left, ph(big, bw, bw * 9 / 16))
  place(bottom + right, dx: -m, dy: -m, ph(small, sw, sw * 9 / 16))
})

// 6 │ Gallery mat — photo floating on white, optional caption below
#let mat(img, caption: none) = page({
  let w = 13cm
  place(top + center, dy: bleed + 1.1cm, ph(img, w, w * 9 / 16))
  if caption != none {
    place(bottom + center, dy: -(bleed + 6mm), cap(caption))
  }
})

// 7 │ Panorama across the spread — ONE photo, TWO pages.
//     Put it on a LEFT page (even page number) so the halves face
//     each other. Crops the photo to ~32:9.
#let pano(img) = {
  let iw = trim-w + page-w      // ensures continuity across the gutter
  page(box(width: 100%, height: 100%, clip: true,
    place(top + left, ph(img, iw, page-h))))
  page(box(width: 100%, height: 100%, clip: true,
    place(top + left, dx: -trim-w, ph(img, iw, page-h))))
}

// 7b │ Panorama trio — full-bleed spread, TWO pages: portrait left,
//      wide landscape across the fold, portrait right. Same rule as
//      pano: start it on a LEFT (even) page.
#let pano-trio(a, b, c, gap: 2mm) = {
  let iw = trim-w + page-w      // ensures continuity across the gutter
  let pw = 7cm                  // portrait strip width (~2:3 at full height)
  let comp = grid(
    columns: (pw, iw - 2 * pw - 2 * gap, pw), column-gutter: gap,
    ph(a, pw, page-h), ph(b, iw - 2 * pw - 2 * gap, page-h), ph(c, pw, page-h),
  )
  page(box(width: 100%, height: 100%, clip: true,
    place(top + left, comp)))
  page(box(width: 100%, height: 100%, clip: true,
    place(top + left, dx: -trim-w, comp)))
}

// 8 │ Blank page (for pacing, or to make a pano land on a left page)
#let blank() = page[]

// 9 │ Staggered pair — two uncropped photos on a diagonal, whitespace around
#let stagger(a, b) = page({
  let w = 7.4cm
  let h = w * 9 / 16
  place(top + left, dx: m, dy: m, ph(a, w, h))
  place(bottom + right, dx: -m, dy: -m, ph(b, w, h))
})

// 10 │ Two bands — stacked full-width strips, each cropped to ~32:9
#let bands(a, b, gap: 2mm) = page({
  let h = (page-h - gap) / 2
  place(top + left, stack(spacing: gap, ph(a, page-w, h), ph(b, page-w, h)))
})

// 10b │ Three bands — like triptych rotated: stacked full-width strips
#let bands3(a, b, c, gap: 2mm) = page({
  let h = (page-h - 2 * gap) / 3
  place(top + left, stack(spacing: gap,
    ph(a, page-w, h), ph(b, page-w, h), ph(c, page-w, h)))
})

// 10c │ Two landscape bands stacked on the left + full-height portrait
//       strip on the right (~2:3), full bleed
#let bands-portrait(a, b, c, gap: 2mm) = page({
  let pw = page-h * 2 / 3
  let lw = page-w - pw - gap
  let bh = (page-h - gap) / 2
  place(top + left, grid(
    columns: (lw, pw), column-gutter: gap,
    stack(spacing: gap, ph(a, lw, bh), ph(b, lw, bh)),
    ph(c, pw, page-h),
  ))
})

// 11 │ Split screen — two portrait halves, full bleed
#let split(a, b, gap: 2mm) = page({
  let w = (page-w - gap) / 2
  place(top + left, grid(
    columns: (w, w), column-gutter: gap,
    ph(a, w, page-h), ph(b, w, page-h),
  ))
})

// 12 │ Triptych — three vertical strips, full bleed, portrait crop
#let triptych(a, b, c, gap: 2mm) = page({
  let w = (page-w - 2 * gap) / 3
  place(top + left, grid(
    columns: (w, w, w), column-gutter: gap,
    ph(a, w, page-h), ph(b, w, page-h), ph(c, w, page-h),
  ))
})

// 13 │ Row of three — small uncropped photos, centered, optional caption
#let row3(a, b, c, gap: 5mm, caption: none) = page({
  let w = (trim-w - 2 * inner - 2 * gap) / 3
  let h = w * 9 / 16
  place(center + horizon, grid(
    columns: (w, w, w), column-gutter: gap,
    ph(a, w, h), ph(b, w, h), ph(c, w, h),
  ))
  if caption != none {
    place(bottom + center, dy: -m, cap(caption))
  }
})

// 14 │ Photo-in-photo — full-bleed background + small framed inset bottom-right
#let inset(bg, small, frame: 2mm) = page({
  place(top + left, ph(bg, page-w, page-h))
  let sw = 5.2cm
  place(bottom + right, dx: -m, dy: -m,
    box(fill: white, inset: frame, ph(small, sw, sw * 9 / 16)))
})

// 15 │ 3×2 grid — six photos, gently cropped (~1.16:1 cells)
#let grid6(a, b, c, d, e, f, gap: 2mm) = page({
  let cw = (page-w - 2 * gap) / 3
  let ch = (page-h - gap) / 2
  place(top + left, grid(
    columns: (cw, cw, cw), rows: (ch, ch),
    column-gutter: gap, row-gutter: gap,
    ..(a, b, c, d, e, f).map(p => ph(p, cw, ch)),
  ))
})
