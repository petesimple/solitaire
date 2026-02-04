🃏 Air Hockey Solitaire

A classic Klondike Solitaire (1-draw) experience, reimagined through the lens of sanctioned air hockey tables, pucks, and mallets.

Built as part of a nostalgia suite of casual games - familiar rules, modern polish, and unmistakably air hockey DNA.

⸻

🎯 Game Overview
	•	Game type: Klondike Solitaire
	•	Draw: 1 card
	•	Scoring: Timed + move counter
	•	Jokers: None (just the classics)

If you know Solitaire, you already know how to play.
If you know air hockey… you’ll feel right at home.

⸻

✨ Features

Core Gameplay
	•	Standard Klondike rules
	•	Drag & drop card movement
	•	Tap-to-move (foundation first)
	•	Automatic face-down card flipping
	•	Win detection with card fireworks 🎆

Quality of Life
	•	⏱ Timer
	•	🔢 Move counter
	•	↩️ Undo (multi-step, safe)
	•	🤖 Auto-finish (only moves cards when it’s safe)

Air Hockey Styling
	•	Custom card backs inspired by sanctioned air hockey tables
	•	Card faces themed around:
	•	Yellow, Red, Green puck colors
	•	Classic toasted-cream mallet tone
	•	More table backs can be added at any time

Settings Panel
	•	🎴 Card back selector
	•	🔊 Sound controls:
	•	Master enable
	•	Shuffle
	•	Place
	•	Win
	•	Settings persist using localStorage

Sound Design
	•	Subtle Web Audio tones
	•	No external audio files
	•	Nostalgia arcade feel (pleasant, not noisy)

⸻

🗂 Folder Structure

/
├─ index.html
├─ style.css
├─ main.js
├─ cards/
│  ├─ fronts/        # 52 SVG card faces
│  └─ backs/
│     ├─ back-v1.png
│     ├─ brunswick.png
│     └─ backs.js    # Auto-generated list of available backs


⸻

➕ Adding New Card Backs
	1.	Drop a PNG into:

cards/backs/


	2.	Refresh the page
	3.	Select it in Settings → Card Back

No code changes required.

⸻

🖥 Running Locally

Just open index.html in a modern browser.

If your browser blocks local assets, run a simple local server:

python3 -m http.server

Then visit:

http://localhost:8000


⸻

🌐 Hosting

Works great on:
	•	GitHub Pages
	•	Static hosting
	•	Local machines
	•	Tablets at tournaments 😉

Make sure the full folder structure is deployed (especially cards/backs/backs.js).

⸻

🛠 Built With
	•	Vanilla HTML / CSS / JavaScript
	•	Web Audio API
	•	No frameworks
	•	No dependencies
	•	No tracking
	•	Just vibes

⸻

❤️ Why This Exists

Because Solitaire is timeless.
Because air hockey tables deserve more representation.
Because nostalgia games should feel familiar and personal.

Play a hand.
Move some cards.
Play puck.
