// ============================================================================
// Public product photos:  GET /api/media/<48-hex key>
// Only files that are registered in product_images are served, and the key is
// validated as hex before it gets anywhere near the filesystem. Optional ?w=400|800 picks a smaller copy. Keys are random
// and never reused, so browsers may cache the file "forever".
// ============================================================================
const fs = require('fs');
const express = require('express');
const prisma = require('../config/db');
const { imageFilePath, imageVariantPath, IMAGE_SIZES } = require('../config/upload');

const router = express.Router();

router.get('/:key', async (req, res) => {
  const { key } = req.params;
  if (!/^[a-f0-9]{48}$/.test(key)) return res.status(404).end();
  try {
    const image = await prisma.productImage.findUnique({ where: { storageKey: key }, select: { mimeType: true } });
    const mainPath = imageFilePath(key);
    if (!image || !image.mimeType || !fs.existsSync(mainPath)) return res.status(404).end();

    // ?w=400 or ?w=800 gives a smaller copy (WebP); older photos without one fall back to the main file
    const width = Number(req.query.w);
    let filePath = mainPath;
    let mimeType = image.mimeType;
    if (IMAGE_SIZES.includes(width)) {
      const variant = imageVariantPath(key, width);
      if (fs.existsSync(variant)) { filePath = variant; mimeType = 'image/webp'; }
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    // The website is on a different address than the API, so the photo must be allowed to load across sites
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('media error:', err);
    res.status(500).end();
  }
});

module.exports = router;
