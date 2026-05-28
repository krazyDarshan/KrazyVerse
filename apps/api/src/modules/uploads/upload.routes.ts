import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../../middleware/auth';
import { isCloudinaryConfigured, uploadToCloudinary } from '../../integrations/storage';
import { asyncHandler } from '../../utils/async-handler';
import { created } from '../../utils/http';

const router = Router();
const uploadDir = path.resolve(process.cwd(), 'tmp/uploads');

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname) || mimeExtension(file.mimetype);
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      cb(new Error('Only image and video uploads are supported'));
      return;
    }
    cb(null, true);
  },
});

function mimeExtension(mimetype: string) {
  if (mimetype === 'image/png') {
    return '.png';
  }
  if (mimetype === 'image/webp') {
    return '.webp';
  }
  if (mimetype === 'video/mp4') {
    return '.mp4';
  }
  return '.jpg';
}

router.post(
  '/media',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(422).json({
        success: false,
        message: 'No file uploaded',
        error: { code: 'FILE_REQUIRED' },
      });
    }
    if (!isCloudinaryConfigured()) {
      const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      return created(
        res,
        {
          url,
          publicId: `local/${req.file.filename}`,
          width: undefined,
          height: undefined,
          duration: undefined,
          resourceType: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
          provider: 'local-dev',
        },
        'Media uploaded locally',
      );
    }

    const result = await uploadToCloudinary(req.file.path, `krazyverse/${req.user!.id}`);
    fs.unlink(req.file.path, () => undefined);
    return created(
      res,
      {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        duration: result.duration,
        resourceType: result.resource_type,
        provider: 'cloudinary',
      },
      'Media uploaded',
    );
  }),
);

export { router as uploadRouter };
