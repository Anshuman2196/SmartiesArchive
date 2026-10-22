# Smarties Archive — Cinema System

## Direction

Smarties Archive is a fiction collection presented like an independent cinema programme. Published covers are the posters. The interface supplies the framing: a dark screening room, a film-frame edge, bold opening-title typography, and simple programme information. The visual treatment gives the existing stories attention without pretending they are films.

The generated projection-room image is atmosphere only. Story art, titles, authors, summaries, and content notes come from published work. The opening image is saved at `public/images/cinema-projection.webp`; its alternate frames the missing-page screen. A neutral generated cover is used only when an author has not supplied one. Genre images illustrate real tag filters, and a foyer illustration inspired by member character sheets marks the community section. Asset roles and prompts are recorded in `ASSETS.md`.

## Color

Cinema is the new default. Archive Night, Original, Royal, and Wine remain selectable and persist locally.

| Token | Cinema value | Use |
| --- | --- | --- |
| `--ink` | `#101010` | Page and navigation |
| `--panel` | `#1b1b1a` | Forms and contained controls |
| `--panel-raised` | `#282522` | Poster fallback and selected surfaces |
| `--cream` | `#f3f0e9` | Main type |
| `--muted` | `#bdb8af` | Secondary type |
| `--lime` | `#ff765f` | Primary action, focus, small programme labels |
| `--line` | `#f3f0e92e` | Dividers |

One accent carries the interface. Story covers retain their own colors. On the generated hero image, a dark overlay protects live text contrast.

## Typography

- One sans-serif family for identity, navigation, headings, controls, and metadata: Arial/Helvetica with weight and width doing the work. No decorative italic or cursive treatment.
- Display headings: 800–900 weight, uppercase, tight tracking, short lines. They echo film opening titles.
- Body and summaries: 14–18px, regular weight, 1.5–1.65 line height.
- Chapter prose remains a reader choice; its serif option belongs to reading preferences, not the site's brand system.

## Layout and spacing

- 4px base rhythm. Common gaps: 8, 12, 16, 24, 32, 48, 72, 96px.
- 1280px content rail. 28px desktop side padding, 20px mobile, 15px on very narrow screens.
- Home: wide photographic frame with one real latest-work poster; the next works form an open poster programme.
- Genre frames appear only for tags present on published stories. They link to the matching library filter.
- Library: search and filters before a scannable cover-and-information list. Keep the covers compact enough that story titles are visible without scrolling past a screen of artwork.
- Author profiles use the same cover-led presentation. An author-supplied cover always takes precedence over the archive fallback.
- Story details: cover, title, synopsis, tags, warnings, then the reading action and chapter programme.
- Shelf and forms use open lists and plain fields. Panels exist only when they contain an interaction.
- The reader opens with content and keeps its saved settings behind a single control. The studio creates a private draft from a title in a dialog, then gives chapters and story details separate, persistent workspaces.
- Publication checks open in a dialog, with blocking items called out in the page. The admin desk opens on stories and keeps chapter and member tables behind section headings.
- Use Lucide icons for ordinary navigation links. Directional arrows are reserved for reader/PDF page movement; stars represent ratings, × marks dismiss/remove actions, and ✳ remains a decorative motif. The header hamburger uses three CSS bars and password visibility uses the words “Show” and “Hide.”

## Interaction

- Search is always visible. Extra filters expand inline and never cover active selections or results.
- Choosing a filter or sort applies it immediately while preserving the other inputs. Active selections can be removed individually or cleared together.
- In-progress shelf entries open the saved chapter. Home entry points send signed-in members to their shelf or studio.
- Hover changes tone or image scale slightly. Reduced-motion settings remove decorative transitions.
- The old palettes remain accessible from the theme selector; reader page-tone controls are separate.
- Studio dialogs, tabs, menus, fields, inputs, and confirmation prompts use the installed shadcn/ui components. Their semantic colors map to the active archive palette in `src/app/globals.css`.

## Reference decisions

- [NYFF59 identity](https://justinwongdesign.com/work/nyff59) informed the use of poster imagery and a restrained film programme grid.
- [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) informed the search-first filter layout.
- [WCAG contrast minimum](https://www.w3.org/TR/wcag/#contrast-minimum) and [focus appearance](https://www.w3.org/WAI/WCAG22/Techniques/general/G195) informed readable text and keyboard focus.
