// --- 1. CONFIGURATION ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const notesFreq = {
    "C3": 130.81, "C#3": 138.59, "D3": 146.83, "D#3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "G3": 196.00, "G#3": 207.65, "A3": 220.00, "A#3": 233.08, "B3": 246.94,
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00, "A#4": 466.16, "B4": 493.88
};

const noteToKeyMap = {
    "C3": "Z", "C#3": "S", "D3": "X", "D#3": "D", "E3": "C", "F3": "V", "F#3": "G", "G3": "B", "G#3": "H", "A3": "N", "A#3": "J", "B3": "M",
    "C4": "Q", "C#4": "2", "D4": "W", "D#4": "3", "E4": "E", "F4": "R", "F#4": "5", "G4": "T", "G#4": "6", "A4": "Y", "A#4": "7", "B4": "U"
};

// Built-in Presets
const presetSongs = {
    twinkle: ["C4", "C4", "G4", "G4", "A4", "A4", "G4", "F4", "F4", "E4", "E4", "D4", "D4", "C4"],
    happyBirthday: ["C4", "C4", "D4", "C4", "F4", "E4", "C4", "C4", "D4", "C4", "G4", "F4"],
    odeToJoy: ["E4", "E4", "F4", "G4", "G4", "F4", "E4", "D4", "C4", "C4", "D4", "E4", "E4", "D4", "D4"]
};

// --- 2. GLOBAL STATE ---
let currentSong = [];
let currentIndex = 0;
let isPlaying = false;
let showKeyNotation = false;

// --- 3. AUDIO ENGINE ---
function playSound(note) {
    if (!notesFreq[note]) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(notesFreq[note], audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.0);
}

// --- 4. SONG MANAGER (New Feature) ---

// Load presets + saved songs into the dropdown
function updateSongDropdown() {
    const select = document.getElementById('songSelect');
    select.innerHTML = '<option value="">-- Select a Song --</option>';

    // Add Presets
    const presetGroup = document.createElement('optgroup');
    presetGroup.label = "Built-in Songs";
    for (let key in presetSongs) {
        const opt = document.createElement('option');
        opt.value = "preset:" + key;
        opt.innerText = key.charAt(0).toUpperCase() + key.slice(1);
        presetGroup.appendChild(opt);
    }
    select.appendChild(presetGroup);

    // Add User Saved Songs
    const savedGroup = document.createElement('optgroup');
    savedGroup.label = "My Saved Songs";
    const savedSongs = JSON.parse(localStorage.getItem('myPianoSongs') || '{}');
    
    for (let name in savedSongs) {
        const opt = document.createElement('option');
        opt.value = "saved:" + name;
        opt.innerText = name;
        savedGroup.appendChild(opt);
    }
    select.appendChild(savedGroup);
}

// Initialize Dropdown on Load
window.onload = updateSongDropdown;

function saveCustomSong() {
    const input = document.getElementById('customInput').value;
    if (!input.trim()) return alert("Type some notes first!");
    
    // Validate notes
    const notes = parseNotes(input);
    if (!notes) return;

    const name = prompt("Enter a name for your song:");
    if (!name) return;

    // Save to Local Storage
    const savedSongs = JSON.parse(localStorage.getItem('myPianoSongs') || '{}');
    savedSongs[name] = notes;
    localStorage.setItem('myPianoSongs', JSON.stringify(savedSongs));

    updateSongDropdown();
    alert(`"${name}" saved successfully!`);
}

function deleteSavedSong() {
    const select = document.getElementById('songSelect');
    const value = select.value;
    
    if (!value.startsWith('saved:')) {
        alert("You can only delete your own saved songs.");
        return;
    }

    const name = value.split('saved:')[1];
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
        const savedSongs = JSON.parse(localStorage.getItem('myPianoSongs') || '{}');
        delete savedSongs[name];
        localStorage.setItem('myPianoSongs', JSON.stringify(savedSongs));
        
        updateSongDropdown();
        stopPractice();
    }
}

function loadSelectedSong() {
    const value = document.getElementById('songSelect').value;
    if (!value) return;

    if (value.startsWith('preset:')) {
        const key = value.split('preset:')[1];
        currentSong = [...presetSongs[key]];
    } else if (value.startsWith('saved:')) {
        const name = value.split('saved:')[1];
        const savedSongs = JSON.parse(localStorage.getItem('myPianoSongs') || '{}');
        currentSong = savedSongs[name];
    }
    
    resetPractice();
}

function previewCustomSong() {
    const input = document.getElementById('customInput').value;
    const notes = parseNotes(input);
    if (notes) {
        currentSong = notes;
        resetPractice();
    }
}

function parseNotes(input) {
    const rawNotes = input.split(/[\s,]+/);
    const cleanNotes = rawNotes.filter(n => notesFreq[n.toUpperCase()]);
    
    if (cleanNotes.length === 0) {
        alert("Invalid notes. Use format: C4 D4 E4");
        return null;
    }
    return cleanNotes.map(n => n.toUpperCase());
}

// --- 5. SHEET MUSIC RENDERER ---
function renderSheetMusic() {
    const container = document.getElementById('sheetMusicDisplay');
    container.innerHTML = "";
    if (currentSong.length === 0) {
        container.innerHTML = '<div class="empty-state">Load a song to start...</div>';
        return;
    }

    currentSong.forEach((note, index) => {
        const noteDiv = document.createElement('div');
        noteDiv.classList.add('sheet-note');
        noteDiv.id = `note-${index}`;
        noteDiv.innerText = showKeyNotation ? noteToKeyMap[note] : note;
        container.appendChild(noteDiv);
    });
    highlightCurrentNote();
}

function highlightCurrentNote() {
    document.querySelectorAll('.sheet-note').forEach((el, idx) => {
        el.classList.remove('current', 'passed');
        if (idx < currentIndex) el.classList.add('passed');
    });

    if (currentIndex < currentSong.length) {
        const currentEl = document.getElementById(`note-${currentIndex}`);
        if (currentEl) {
            currentEl.classList.add('current');
            currentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        
        // Highlight Key
        const note = currentSong[currentIndex];
        document.querySelectorAll('.key').forEach(k => k.classList.remove('guide'));
        const guideKey = document.querySelector(`.key[data-note="${note}"]`);
        if (guideKey) guideKey.classList.add('guide');
    } else {
        document.querySelectorAll('.key').forEach(k => k.classList.remove('guide'));
    }
}

function toggleSheetNotation() {
    showKeyNotation = !showKeyNotation;
    document.getElementById('notationToggleBtn').innerText = showKeyNotation ? "⌨ Show: Keyboard Keys" : "👁 Show: Standard Notes";
    if (currentSong.length > 0) renderSheetMusic();
}

function resetPractice() {
    currentIndex = 0;
    isPlaying = true;
    renderSheetMusic();
}

function stopPractice() {
    isPlaying = false;
    currentSong = [];
    currentIndex = 0;
    renderSheetMusic();
    document.querySelectorAll('.key').forEach(k => k.classList.remove('guide'));
}

// --- 6. INPUT HANDLING ---
function handleInput(note) {
    playSound(note);
    if (isPlaying && currentIndex < currentSong.length) {
        if (note === currentSong[currentIndex]) {
            currentIndex++;
            highlightCurrentNote();
            if (currentIndex >= currentSong.length) {
                setTimeout(() => alert("🎉 Song Complete!"), 200);
                isPlaying = false;
            }
        }
    }
}

window.addEventListener('keydown', (e) => {
    if (e.repeat || document.activeElement.tagName === 'INPUT') return;
    const keyEl = document.querySelector(`.key[data-key="${e.key.toLowerCase()}"]`);
    if (keyEl) {
        keyEl.classList.add('active');
        handleInput(keyEl.getAttribute('data-note'));
    }
});

window.addEventListener('keyup', (e) => {
    const keyEl = document.querySelector(`.key[data-key="${e.key.toLowerCase()}"]`);
    if (keyEl) keyEl.classList.remove('active');
});

document.querySelectorAll('.key').forEach(k => {
    k.addEventListener('mousedown', () => { handleInput(k.getAttribute('data-note')); k.classList.add('active'); });
    k.addEventListener('mouseup', () => k.classList.remove('active'));
    k.addEventListener('mouseleave', () => k.classList.remove('active'));
});