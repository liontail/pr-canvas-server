const pad = (n) => String(n).padStart(2, '0')

export function Walkthrough ({ steps, index, onIndex, onLeave }) {
  return (
    <aside class="walk" aria-live="polite">
      <div class="walk-count">{pad(index + 1)} / {pad(steps.length)}</div>
      <ol>
        {steps.map((step, i) => (
          <li key={step.id} class={i === index ? 'current' : 'faded'}>
            <button type="button" aria-current={i === index ? 'step' : undefined} onClick={() => onIndex(i)}>{step.heading}</button>
            {i === index && <p>{step.body}</p>}
          </li>
        ))}
      </ol>
      <footer>
        <button type="button" disabled={index === 0} onClick={() => onIndex(index - 1)}>Back</button>
        <button type="button" disabled={index === steps.length - 1} onClick={() => onIndex(index + 1)}>Next</button>
        <button type="button" onClick={onLeave}>ESC TO LEAVE</button>
      </footer>
    </aside>
  )
}
