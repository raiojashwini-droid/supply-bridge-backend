import * as cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { importQueue } from './queue.service';

const prisma = new PrismaClient();
const scheduledTasks = new Map<string, cron.ScheduledTask>();
let refreshTask: cron.ScheduledTask | null = null;
let isRefreshing = false;

export class SchedulerService {
  /**
   * Loads all active supplier schedules and registers them with node-cron.
   */
  static async reloadSchedules() {
    if (isRefreshing) return;
    isRefreshing = true;

    console.log('🔄 Loading synchronization schedules...');
    
    // Clear existing supplier tasks if restarting
    scheduledTasks.forEach(task => task.stop());
    scheduledTasks.clear();

    try {
      const schedules = await prisma.supplierSchedule.findMany({
        where: { isActive: true },
        include: { supplier: true }
      });

      for (const schedule of schedules) {
        if (!cron.validate(schedule.cronExpression)) {
          console.warn(`⚠️ Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`);
          continue;
        }

        const task = cron.schedule(schedule.cronExpression, async () => {
          console.log(`⏰ Triggering scheduled sync for Supplier: ${schedule.supplier.name} (${schedule.dataType})`);
          
          try {
            // Enqueue an import job. The importQueue worker will handle fetching and processing.
            await importQueue.add('scheduled-import', {
              supplierId: schedule.supplierId,
              dataType: schedule.dataType,
              triggeredBy: 'Scheduler',
              scheduleId: schedule.id
            }, {
              jobId: `import-${schedule.supplierId}-${Date.now()}`,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              }
            });
          } catch (jobErr: any) {
            console.error(`❌ Failed to enqueue import for supplier ${schedule.supplierId}:`, jobErr.message || jobErr);
          }
        });

        scheduledTasks.set(schedule.id, task);
      }
      
      console.log(`✅ Scheduler active with ${scheduledTasks.size} configured schedules.`);
    } catch (error) {
      console.error('❌ Failed to load schedules:', error);
    } finally {
      isRefreshing = false;
    }
  }

  /**
   * Starts scheduler and configures a single periodic refresh job.
   */
  static async startScheduler() {
    await this.reloadSchedules();

    // Setup periodic refresh ONLY ONCE to avoid exponential cron duplication
    if (!refreshTask) {
      refreshTask = cron.schedule('*/5 * * * *', async () => {
        await this.reloadSchedules();
      });
    }
  }
}
