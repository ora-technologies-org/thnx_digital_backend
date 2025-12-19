import { Router } from 'express';
import { listActivityLogs, getStats, getTimeline } from '../controllers/activityLog.controller';
import {authenticate, authorize} from '../middleware/auth.middleware';


const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));


router.get('/', listActivityLogs);

router.get('/stats', getStats);

router.get('/timeline/:resourceType/:resourceId', getTimeline);

export default router;