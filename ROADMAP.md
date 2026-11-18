# Roadmap

## The direction

EliteBall should become something you glance at on a phone: a card for an upcoming fixture, a press of play, and a ninety second simulation you can watch while you wait. Behind it, a context layer of hidden values decides how each player actually performs on the day.

## 1. The context layer (next)

The engine currently takes assessed values at face value. Real performance moves with circumstances, so add a context layer that adjusts the inputs before the engine sees them:

| Factor | Effect | Source of the value |
| --- | --- | --- |
| Home or away | Small boost to pressing and shooting for the home side | Fixture |
| Rest days | Fatigue penalty below four days between matches | Fixture list |
| Travel | Small sharpness penalty for long trips | Fixture and club base |
| Confidence | Rolling form from the last five results, weighted by margin | Results |
| Pressure | Morale penalty when the table position implies stakes | Table |
| Weather and pitch | Pass accuracy and tempo modifiers | Manual or feed |

Each factor is a named multiplier with a prior, applied to specific attributes, and every one is recorded in the match output so a result can be explained. The demo gets a reveal toggle that shows the adjustments, and a lab mode with sliders for testing a single factor.

## 2. A feed of match cards

A PWA first, because it ships today and works on both platforms. A vertical feed of upcoming fixtures, each card carrying the two clubs, the kickoff time, a form strip and a play button. Pressing play opens the full screen simulation with the existing viewer.

The card itself is the product. It needs a compact result summary after the simulation, and a share image for sending a result to someone.

## 3. Native widgets, with honest limits

iOS widgets and Android Glance widgets cannot animate a canvas. They refresh on a timeline and accept limited taps. What they can do:

- Show the next fixture and a play button that deep links into the app.
- Show the last simulated result as a small score card.
- On iOS, a Live Activity during a simulation, which is the closest thing to a live widget.

A widget that appears to run a match would be a video, not a simulation. Better to keep the simulation in the app and let the widget be the doorway.

## 4. Real fixtures

A fixture feed needs a provider. football-data.org has a free tier covering the Premier League with rate limits; API-Football and Sportmonks are paid and richer. Lineups and availability are the expensive part, and they arrive close to kickoff.

The output should be a distribution: run the fixture a thousand times with different seeds and show win, draw and loss probabilities plus the most likely scorelines. A single predicted score is not a forecast, it is a coin flip presented as knowledge.

Real squads stay in the local pack. The public repository keeps invented squads and the programme submission stays clean.

## 5. League and season

Twenty clubs, a fixture list, a table that accumulates. Each club carries its own tactics and its own context history, so confidence and fatigue carry across matches rather than resetting.

## Interface work

A floating mini window through Document Picture-in-Picture for desktop, average position and pass network overlays, a shot map, and JSON or CSV export of events and frames.

## Known limits

No offside, fouls, cards or set pieces. No spatial contest for the ball, so pressing changes turnover rates rather than the shape of the press. Goals run slightly high. The model is not calibrated against a league, and the README says so rather than implying otherwise.
