import type { Template } from './template';

/** A web app's moving parts: client, load balancer, an API tier, data, and a worker. */
export const architecture: Template = {
  id: 'architecture',
  name: 'Web app architecture',
  description: 'Services, data stores, and a job queue',
  build(kit) {
    const client = kit.rect(0, 210, 150, 70, { stroke: 'Slate', fill: 'Gray' });
    const balancer = kit.rect(220, 210, 170, 70, { stroke: 'Violet', fill: 'Violet' });
    const tier = kit.rect(460, 80, 220, 330, { stroke: 'Slate' });
    const api1 = kit.rect(490, 130, 160, 70, { stroke: 'Blue', fill: 'Blue' });
    const api2 = kit.rect(490, 290, 160, 70, { stroke: 'Blue', fill: 'Blue' });
    const cache = kit.ellipse(770, 90, 170, 70, { stroke: 'Orange', fill: 'Orange' });
    const database = kit.ellipse(770, 270, 170, 90, { stroke: 'Green', fill: 'Green' });
    const queue = kit.rect(770, 450, 170, 60, { stroke: 'Yellow', fill: 'Yellow' });
    const worker = kit.rect(1010, 450, 150, 60, { stroke: 'Blue', fill: 'Blue' });
    return [
      kit.text('Web app architecture', 0, 0, { size: 28 }),
      kit.text('Each arrow is attached: drag a box and its arrows follow.', 0, 44, {
        size: 16,
        color: 'Slate',
      }),
      ...kit.group(client, kit.label('Browser', client)),
      ...kit.group(balancer, kit.label('Load balancer', balancer)),
      // The tier's frame, title, and servers move as one.
      ...kit.group(
        tier,
        kit.text('API tier', 476, 92, { size: 16, color: 'Slate' }),
        api1,
        kit.label('API server', api1),
        api2,
        kit.label('API server', api2),
      ),
      ...kit.group(cache, kit.label('Cache', cache)),
      ...kit.group(database, kit.label('Database', database)),
      ...kit.group(queue, kit.label('Job queue', queue)),
      ...kit.group(worker, kit.label('Worker', worker)),
      kit.arrow(client, 'right', balancer, 'left'),
      kit.arrow(balancer, 'right', api1, 'left'),
      kit.arrow(balancer, 'right', api2, 'left'),
      kit.arrow(api1, 'right', cache, 'left', { stroke: 'Orange' }),
      kit.arrow(api1, 'right', database, 'left', { stroke: 'Green' }),
      kit.arrow(api2, 'right', database, 'left', { stroke: 'Green' }),
      kit.arrow(api2, 'bottom', queue, 'left', { stroke: 'Yellow' }),
      kit.arrow(queue, 'right', worker, 'left'),
      kit.arrow(worker, 'top', database, 'right', { stroke: 'Green' }),
    ];
  },
};
