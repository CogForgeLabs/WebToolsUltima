import { useJobs, type Job } from '../../core/jobs/store';
import { formatBytes, sizeDelta } from '../../core/util/bytes';
import { downloadUrl, downloadAllAsZip } from '../../core/util/download';
import { FilePreview } from './preview/FilePreview';

export function JobResults({ jobIds }: { jobIds: string[] }) {
  const jobs = useJobs((s) => s.jobs);
  const mine = jobs.filter((j) => jobIds.includes(j.id));
  if (mine.length === 0) return null;
  return (
    <div className="results">
      <h2>Results</h2>
      {mine.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}

export function JobCard({ job }: { job: Job }) {
  const cancel = useJobs((s) => s.cancel);
  const remove = useJobs((s) => s.remove);
  const inputBytes = job.inputs.reduce((n, f) => n + f.size, 0);

  return (
    <div className={`jobcard status-${job.status}`}>
      <div className="jobcard-head">
        <span className="job-label">{job.label}</span>
        <span className={`job-status ${job.status}`}>{statusText(job)}</span>
        {(job.status === 'queued' || job.status === 'running') && (
          <button className="mini" onClick={() => cancel(job.id)}>
            Stop
          </button>
        )}
        {(job.status === 'done' || job.status === 'error' || job.status === 'cancelled') && (
          <button className="mini" onClick={() => remove(job.id)}>
            Clear
          </button>
        )}
      </div>

      {(job.status === 'queued' || job.status === 'running') && (
        <div className="progress">
          <div className="progress-fill" style={{ width: `${Math.round(job.progress * 100)}%` }} />
        </div>
      )}

      {job.status === 'error' && <p className="job-error">{job.error}</p>}

      {job.status === 'done' && job.outputs.length > 0 && (
        <div className="outputs">
          {job.outputs.length > 1 && (
            <button className="mini primary" onClick={() => downloadAllAsZip(job.outputs)}>
              ⬇ Download all ({job.outputs.length}) as .zip
            </button>
          )}
          {job.outputs.map((o, i) => (
            <div className="outcard" key={`${o.name}-${i}`}>
              {job.outputs.length <= 6 && (
                <div className="out-preview">
                  <FilePreview url={o.url} formatId={o.formatId} name={o.name} />
                </div>
              )}
              <div className="outrow">
                <span className="out-name">{o.name}</span>
                <span className="out-size">
                  {formatBytes(o.size)}
                  {inputBytes > 0 && job.outputs.length === 1 && <em className="delta"> {sizeDelta(inputBytes, o.size)}</em>}
                </span>
                <button className="mini primary" onClick={() => downloadUrl(o.url, o.name)}>
                  ⬇ Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function statusText(job: Job): string {
  switch (job.status) {
    case 'queued':
      return 'Queued…';
    case 'running':
      return `${Math.round(job.progress * 100)}%`;
    case 'done':
      return 'Done';
    case 'error':
      return 'Failed';
    case 'cancelled':
      return 'Stopped';
  }
}
