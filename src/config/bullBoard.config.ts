import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { activityLogQueue } from '../queues/activityLog.queue';
import { emailQueue } from '../queues/email.queue';
import { notificationQueue  } from '../queues/notification.queue';

export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(activityLogQueue),
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(notificationQueue),

  ],
  serverAdapter: serverAdapter,
});

export default serverAdapter;