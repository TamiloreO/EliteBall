# Roadmap

## Next

A league layer. Twenty invented clubs in an English-style pyramid, a round-robin fixture list, and a table that accumulates across a season. Each club gets its own preset, so a season is a sequence of simulated matches rather than one.

A local squad loader. A JSON schema for squads, conditions and rumours, read from a folder that git ignores. That is how real squads get used without real data entering the repository.

Monte Carlo. Run the same fixture a thousand times with different seeds and report the distribution of scorelines, shots and expected goals, rather than a single result.

## Later

Tactical priors from tracking data. Metrica and SkillCorner publish matches you can download yourself; a reader that turns them into pressing height, compactness and line height would let a simulated team inherit a real team's shape without inheriting its players.

Set pieces, offside, fouls and cards. The engine currently treats every stoppage as a restart from deep, which is the largest gap between it and a real match.

Substitutions and fatigue curves. Stamina already decays with pressing intensity; the next step is bench decisions and a visible drop in the last twenty minutes.

## Interface

A floating mini window through the Document Picture-in-Picture API, so the map sits beside a broadcast on Chromium browsers, with a plain popup fallback elsewhere.

Overlays: average positions, compactness lines, a pass network, and a shot map. Export of events and frames as JSON or CSV so the output can be analysed elsewhere.

## Known limits

The model has no spatial contest for the ball, so pressing changes turnover rates rather than the geometry of the press. Goals run slightly high. There is no calibration against a real league, and the README says so rather than implying otherwise.
