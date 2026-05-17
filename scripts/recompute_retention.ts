/**
 * Trigger único do recompute de risco de evasão. Usado pelo deploy para
 * popular dados reais sem precisar de login admin no UI.
 */
import { recomputeAllRisks } from '../server/services/retention-calculator';
import { listCourses } from '../server/repositories/courses';

(async () => {
  const courses = await listCourses();
  const hoursById = new Map(courses.map((c) => [c.id, c.totalHours ?? 30]));
  const summary = await recomputeAllRisks({
    courseHours: (id) => hoursById.get(id) ?? 30,
  });
  console.log(JSON.stringify(summary, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
