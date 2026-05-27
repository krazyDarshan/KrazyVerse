import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { requestId } from './middleware/request-id';
import { redisRateLimit } from './middleware/rate-limit';
import { errorHandler, notFound } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { postRouter } from './modules/posts/post.routes';
import { profileRouter } from './modules/profiles/profile.routes';
import { feedRouter } from './modules/feed/feed.routes';
import { storyRouter } from './modules/stories/story.routes';
import { reelRouter } from './modules/reels/reel.routes';
import { messageRouter } from './modules/messages/message.routes';
import { discoveryRouter } from './modules/discovery/discovery.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { creatorRouter } from './modules/creator/creator.routes';
import { securityRouter } from './modules/security/security.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { futureRouter } from './modules/future/future.routes';
import { uploadRouter } from './modules/uploads/upload.routes';

export function createApp() {
  const app = express();

  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(redisRateLimit({ prefix: 'api', windowMs: 60 * 1000, max: 300 }));

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', service: 'krazyverse-api' }, message: 'Healthy' });
  });

  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use('/profiles', profileRouter);
  v1.use('/posts', postRouter);
  v1.use('/feed', feedRouter);
  v1.use('/stories', storyRouter);
  v1.use('/reels', reelRouter);
  v1.use('/messages', messageRouter);
  v1.use('/discovery', discoveryRouter);
  v1.use('/ai', aiRouter);
  v1.use('/creator', creatorRouter);
  v1.use('/security', securityRouter);
  v1.use('/admin', adminRouter);
  v1.use('/future', futureRouter);
  v1.use('/uploads', uploadRouter);

  app.use('/api/v1', v1);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
