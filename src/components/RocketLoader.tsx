/**
 * Tiny race-in-progress rocket. CSS from Uiverse.io by anand_4957.
 * Scaled to ~25% via .race-rocket-wrap. Only render when a race is actively running.
 */
export default function RocketLoader() {
  return (
    <div className="flex items-center gap-3">
      <div className="race-rocket-wrap">
        <div className="race-rocket-scale">
          <div className="race-loader">
            <span>
              <span /><span /><span /><span />
            </span>
            <div className="race-base">
              <span />
              <div className="race-face" />
            </div>
          </div>
          <div className="race-longfazers">
            <span /><span /><span /><span />
          </div>
        </div>
      </div>
      <span className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground animate-pulse">
        Race in progress
      </span>
    </div>
  );
}
