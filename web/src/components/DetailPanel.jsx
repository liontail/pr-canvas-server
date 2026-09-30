import { Fragment } from 'preact'

export function DetailPanel ({ model, onClose }) {
  return (
    <aside class="detail" role="complementary" aria-label="Details">
      <header>
        <div>
          <span class="kind">{model.kind}</span>
          <h2>{model.title}</h2>
        </div>
        <button type="button" aria-label="Close details" onClick={onClose}>×</button>
      </header>
      {model.note && <p class="lead">{model.note}</p>}
      <dl>
        {model.meta.map(([label, value]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
      {model.badges.length > 0 && (
        <ul class="chips">{model.badges.map((badge) => <li key={badge}>{badge}</li>)}</ul>
      )}
      {model.sides.map((side) => (
        <section key={side.name}>
          <h3>{side.name} · <code>{side.type}</code></h3>
          {side.changedPaths.length > 0 && <p class="changed">Changed: {side.changedPaths.join(', ')}</p>}
          {side.shape && <pre>{side.shape}</pre>}
          <div class="pair">
            {side.before && (
              <div>
                <h3>Before</h3>
                <pre>{side.before}</pre>
              </div>
            )}
            {side.sample && (
              <div>
                <h3>{side.before ? 'After' : 'Sample'}</h3>
                <pre>{side.sample}</pre>
              </div>
            )}
          </div>
        </section>
      ))}
      {model.files.length > 0 && (
        <section>
          <h3>Files</h3>
          <ul class="files">{model.files.map((file) => <li key={file}><code>{file}</code></li>)}</ul>
        </section>
      )}
    </aside>
  )
}
