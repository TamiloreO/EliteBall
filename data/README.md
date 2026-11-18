# Local squad pack

This folder is ignored by git. Anything you put here is yours and never enters the public repository.

The demo looks for `data/squads.json` on load. If it is present, the viewer uses those squads instead of the invented defaults. If it is missing, the public demo still runs.

## Format

```json
{
  "home": {
    "name": "Arsenal",
    "formation": "4-3-3",
    "tactics": { "lineHeight": 0.6, "press": 0.55, "width": 0.58, "tempo": 0.55 },
    "players": [
      { "name": "D R", "num": 1, "attrs": { "pace": 55, "passing": 70, "dribbling": 40, "shooting": 25, "pressing": 30, "positioning": 85, "stamina": 70 } }
    ]
  },
  "away": { "name": "Liverpool", "formation": "4-3-3", "tactics": {}, "players": [] }
}
```

Rules the loader relies on:

The `players` array must follow the formation order in `src/model.js`: goalkeeper first, then the back line left to right, then midfield, then the front line. Roles are taken from the formation, not from the file.

`name` is displayed as initials, so write it as spaced initials, `"D R"`, not a full name. `num` is the jersey number and is what appears in the circle on the pitch.

`attrs` are 1 to 99. `condition` is optional and takes `fitness`, `sharpness`, `morale` (from -1 to 1) and `distraction` (0 to 1).

## Why this exists

Real players' initials, shirt numbers and club together identify a person, and the programme's rules exclude projects that process real personal data. Keeping the pack local means you can run recognisable squads without putting them in the submission. Do not commit this folder.
