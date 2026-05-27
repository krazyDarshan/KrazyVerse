import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth';
import { uploadToCloudinary } from '../../integrations/storage';
import { asyncHandler } from '../../utils/async-handler';
import { created } from '../../utils/http';

const router = Router();
const upload = multer({ dest: 'tmp/uploads', limits: { fileSize: 100 * 1024 * 1024 } });

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
    const result = await uploadToCloudinary(req.file.path, `krazyverse/${req.user!.id}`);
    return created(
      res,
      {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        duration: result.duration,
        resourceType: result.resource_type,
      },
      'Media uploaded',
    );
  }),
);

export { router as uploadRouter };
