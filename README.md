# gorecz // archive

**[ [English](#english) | [Русский](#russian) ]**

---

<a name="english"></a>

## [EN] Interactive Audio-Visual Ecosystem

```text
[ status: online ]
[ architecture: interactive audio-visual monorepo ]
[ dsp / render: vanilla js · webgl · glsl · web audio api · canvas 2d ]
```

**gorecz archive** is a centralized web hub and a series of isolated, procedural audio-visual worlds built for music releases by **gorecz**. 
Instead of standard streaming landing pages, each release is engineered as a standalone digital environment with its own custom physics, GLSL fragment shaders, spatial audio routing, and real-time frequency reactivity.

### 01 // System Architecture & Technical Stack

Built on native web APIs with a zero-dependency philosophy for release pages, ensuring granular control over memory, frame timing, and GPU fill-rate:

* **Graphics & Shaders:** Raw WebGL & GLSL (domain-warped FBM fog, liquid refraction, anamorphic horizontal motion blur, chromatic aberration) paired with high-density 2D Canvas particle and graph simulations.
* **Audio DSP Engine:** `Web Audio API` + `OfflineAudioContext` — silent pre-decoding of audio buffers to extract 30 FPS RMS envelopes (Sub/Bass, Highs, Master Level), rising zero-crossing triggers for stable oscillography, LFO modulation (Echo, Space, Flange, Chorus), and pointer-tracked 3D Spatial Audio panning.
* **Hardware Adaptation:** Dynamic `devicePixelRatio` clamping and automatic shader resolution scaling (`lighter()` fallback pass) triggered via frame-time profiling and `WEBGL_debug_renderer_info` GPU detection for smooth performance on integrated graphics and mobile browsers.

### 02 // Release Index (Worlds)

| ID | Release | Visual & Mechanical Concept | Status |
| :--- | :--- | :--- | :--- |
| **`000`** | **`gorecz archive`** | Central index hub, release navigation, and ecosystem lore. | `MVP in progress` |
| **`001`** | **`infinity.dark`** | Nocturnal ambient-trap terminal. Features an inertial vinyl turntable with tonearm scrubbing, a live XY stereo oscilloscope (lemniscate curve with phosphor afterglow), a 3D stylized cortex (~4,170 neurons across 6 regions firing with the track), synchronized HUD lyrics, and a reactive WebGL horizon fog shader. | `Deployed` |
| **`002`** | **`Искусственно (Artificial)`** | Submerged cyber-noir environment. Deep-water steel-blue abyss with tensioned 3D cables, electric short-circuit sparks driven by sub-bass peaks, and a flooded-glass post-processing shader with horizontal water smearing. | `In development` |

### 03 // Repository Structure

```text
gorecz-archive/
├── index.html            # Central Archive Hub (000)
├── infinity.dark/        # World 001: infinity.dark
│   ├── index.html        # Stage layout, SVG turntable deck & HUD
│   ├── script.js         # Core loop, OfflineAudioContext analyser, WebGL fog & lyrics
│   ├── scope.js          # Stereo XY Lemniscate Oscilloscope
│   └── brain.js          # 3D Cortex simulation (~4170 neurons & bilateral callouts)
└── iskusstvenno/         # World 002: Искусственно (WIP)
```

### 04 // Local Development

Because the audio engine fetches and decodes raw audio bytes via `OfflineAudioContext`, pages must be served over `http://` or `https://` (opening `index.html` via `file://` will fall back to synthetic waveform simulation):

```bash
# Run a local static server from the repository root:
npx serve .
# or using Python:
python -m http.server 8080
```

---
---

<a name="russian"></a>

## [RU] Интерактивная аудиовизуальная экосистема

```text
[ status: online ]
[ architecture: interactive audio-visual monorepo ]
[ dsp / render: vanilla js · webgl · glsl · web audio api · canvas 2d ]
```

**gorecz archive** — центральный веб-хаб и серия изолированных процедурных аудиовизуальных миров для музыкальных релизов **gorecz**. 
Вместо шаблонных промо-страниц каждый трек получает собственное цифровое пространство с уникальной физикой, кастомными GLSL-шейдерами, пространственным звуком и честной реакцией на спектр аудиосигнала в реальном времени.

### 01 // Архитектура и технический стек

Ядро промо-страниц написано на чистом Vanilla JS и нативных браузерных API без внешних зависимостей, что дает полный контроль над рендер-лупом и нагрузкой на GPU/CPU:

* **Графика и шейдеры:** Нативный WebGL / GLSL (процедурный FBM-туман с доменным искажением, преломление света через воду, горизонтальный анаморфный смаз, пленочное зерно) и 2D Canvas для симуляции нейронных сетей и осциллографов.
* **Аудио-ядро (DSP):** `Web Audio API` + `OfflineAudioContext` — фоновое декодирование аудиофайла при загрузке для построения точной волны (1440 пиков) и 30 FPS огибающих (`bass`, `high`, `level`), синхронизация по пересечению нуля (Zero-Crossing), блок эффектов (Echo, Space, Flange, Chorus) и 3D Spatial Audio панорамирование за курсором.
* **Адаптивная оптимизация:** Контроль `devicePixelRatio`, детект встроенных видеоядер (`WEBGL_debug_renderer_info`) и автоматическое снижение внутреннего разрешения шейдера при просадках FPS в первые секунды работы.

### 02 // Индекс релизов (Миры)

| Код | Релиз | Визуальный и механический концепт | Статус |
| :--- | :--- | :--- | :--- |
| **`000`** | **`gorecz archive`** | Главный входной узел экосистемы, индекс релизов и навигация. | `MVP in progress` |
| **`001`** | **`infinity.dark`** | Ночной дарк-эмбиент терминал. Виниловый проигрыватель с физикой инерции диска и скраббингом тонармом, стерео XY-осциллограф (знак бесконечности с фосфорным шлейфом), 3D-модель коры мозга (~4170 нейронов в 6 отделах) с откликом на частоты, синхронизированный HUD текста и шейдер ночного тумана. | `Ready / Deployed` |
| **`002`** | **`Искусственно`** | Подводный кибер-нуар. Глубоководная сцена в стальных сине-белых тонах с натянутыми в воде проводами, электрическими пробоями в такт басу и шейдером «затопленного стекла» с горизонтальным размытием. | `In development` |

### 03 // Структура проекта

```text
gorecz-archive/
├── index.html            # Главная страница архива (000)
├── infinity.dark/        # Мир 001: infinity.dark
│   ├── index.html        # Разметка сцены, SVG-дека винила и интерфейс
│   ├── script.js         # Главный цикл, анализатор спектра, WebGL-туман и лирика
│   ├── scope.js          # Стерео XY-осциллограф (лемниската)
│   └── brain.js          # 3D-симуляция коры мозга (~4170 нейронов)
└── iskusstvenno/         # Мир 002: Искусственно (в разработке)
```

### 04 // Локальный запуск

Для работы `fetch` и декодирования аудио через `OfflineAudioContext` проект необходимо запускать через локальный веб-сервер (при открытии напрямую через `file://` включится демо-режим с синтетической волной):

```bash
# Через VS Code Live Server или в терминале из корня проекта:
npx serve .
# или через Python:
python -m http.server 8080
```
