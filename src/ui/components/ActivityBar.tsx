import { useState } from 'react';
import { isActive, useJobs } from '../../core/jobs/store';
import { JobCard } from './ResultList';

export function ActivityBar() {
  const jobs = useJobs((s) => s.jobs);
  const clearFinished = useJobs((s) => s.clearFinished);
  const [open, setOpen] = useState(false);

  if (jobs.length === 0) return null;
  const active = jobs.filter((j) => isActive(j.status));

  return (
    <div className={`activitybar${open ? ' open' : ''}`}>
      <button className="activity-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="act-dot" data-active={active.length > 0} />
        {active.length > 0 ? `${active.length} running` : `${jobs.length} recent`}
        <span className="chev">{open ? '▾' : '▴'}</span>
      </button>

      {open && (
        <div className="activity-panel">
          <div className="activity-head">
            <strong>Activity</strong>
            <button className="mini" onClick={clearFinished}>
              Clear finished
            </button>
          </div>
          <div className="activity-list">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
