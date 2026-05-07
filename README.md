# 🌿 Jungle Run

A fast-paced 2D endless runner set in a prehistoric jungle. Jump over obstacles, slide under vines, and survive as long as you can while the speed keeps climbing.

**[▶ Play Now](https://moodcharan240-bit.github.io/jungle-run)**

---

## 🎮 Gameplay

![Jungle Run](https://img.shields.io/badge/HTML5-Canvas-green?style=flat-square) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-yellow?style=flat-square) ![Size](https://img.shields.io/badge/Size-under%2010KB-blue?style=flat-square)

Your runner sprints automatically through the jungle. Dodge obstacles using two moves:

| Action | Keyboard | Mobile |
|--------|----------|--------|
| **Jump** | `↑` or `Space` | Swipe Up |
| **Double Jump** | Press jump again mid-air | Swipe Up twice |
| **Slide** | `↓` | Swipe Down |

### Obstacles

| Obstacle | How to beat |
|----------|-------------|
| 🪵 Stump / Rock / Box | **Jump** over it |
| 🌳 Tall Tree (branch) | **Slide** under it |
| 🍃 Hanging Vines | **Slide** under it |
| 🪵🪵 Double Stump | **Jump** (harder timing, appears at high speed) |

Speed increases over time — how long can you last?

---

## 👾 Characters

Choose from 3 prehistoric runners before the game starts:

| Character | Style | Strength |
|-----------|-------|----------|
| **GRONK** | Caveman Brute | High strength, bone club |
| **ZARA** | Tribal Warrior | Max agility, spear |
| **MIKO** | Forest Shaman | Max jump, glowing staff |

---

## 🚀 How to Run Locally

No server, no install, no dependencies.

```bash
git clone https://github.com/moodcharan240-bit/jungle-run.git
cd jungle-run
open index.html   # macOS
# or just double-click index.html on Windows/Linux
```

---

## 🛠️ Tech Stack

- **HTML5 Canvas** — all rendering
- **Vanilla JavaScript** — zero frameworks
- **CSS3** — UI screens and animations
- **No libraries, no build step, no server required**

### Performance Features
- `requestAnimationFrame` game loop
- Object pooling for obstacles
- Parallax 5-layer scrolling background
- Procedural SVG-style character drawing
- Particle system (dust, hit effects)
- Screen shake on collision

---

## 📁 Project Structure

```
jungle-run/
├── index.html      # Screens, HUD, layout
├── style.css       # UI styling, prehistoric theme
└── js/
    └── game.js     # Complete game engine (~1100 lines)
```

---

## 📜 License

MIT — free to use, modify, and share.

---

Made with ❤️ using pure HTML5 Canvas + Vanilla JS
