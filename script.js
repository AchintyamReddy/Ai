```javascript
/*************************************************************************
 * AI Educational Assistant - app.js
 * - Modular subject system
 * - Initial selective quiz
 * - Language and TTS support
 * - Adaptive difficulty and spaced repetition
 * - Pluggable AI integration point
 *************************************************************************/

// === Configuration ===
// Replace with your AI endpoint and key if you have one.
// If left as-is, the app uses a local fallback for assistant responses.
const AI_API_ENDPOINT = "https://your-ai-endpoint.example.com/generate";
const AI_API_KEY = "REPLACE_WITH_KEY";

const LANGUAGE_MAP = {
  en: { label: "English", tts: "en-US" },
  es: { label: "Español", tts: "es-ES" },
  fr: { label: "Français", tts: "fr-FR" },
  hi: { label: "हिन्दी", tts: "hi-IN" }
};

// === Persistence ===
const STORAGE_KEY = "ai_edu_assistant_v1";
function loadState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e){ return {}; }
}
function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// === Default state ===
let state = loadState();
state.user = state.user || { name: "Student", language: "en", ttsEnabled: true };
state.progress = state.progress || {};
state.reviewQueue = state.reviewQueue || [];
state.settings = state.settings || { difficulty: "auto" };
saveState(state);

// === Module Interface ===
class Module {
  constructor(id, title, description){
    this.id = id; this.title = title; this.description = description;
  }
  async generateLesson(context){ return `<div><strong>${this.title}</strong><div class="small">${this.description}</div></div>`; }
  async generateQuestion(difficulty){ return { prompt: `Sample question for ${this.title}`, choices: ["A","B","C","D"], answer: 0, type: "mcq" }; }
  async explainAnswer(question, userAnswer){ return `Explanation for ${this.title}: correct answer is ${question.choices[question.answer]}`; }
}

// === Built-in Modules ===
const modules = {
  math: new (class extends Module {
    constructor(){ super("math","Math","Numbers, algebra, geometry, and problem solving"); }
    async generateLesson(ctx){
      return `
        <div style="font-weight:700">Algebra Warmup</div>
        <div class="small">Solving linear equations</div>
        <div style="margin-top:10px">
          <div class="question">Solve for x</div>
          <div>\\(3x + 5 = 20\\)</div>
          <div style="margin-top:8px"><button class="btn" data-action="show-solution">Show solution</button></div>
          <div id="math-solution" class="small" style="margin-top:8px;display:none">
            Step 1: Subtract 5 from both sides: \\(3x = 15\\). Step 2: Divide by 3: \\(x = 5\\).
          </div>
        </div>`;
    }
    async generateQuestion(difficulty){
      const scale = difficulty === "easy" ? 1 : difficulty === "hard" ? 3 : 2;
      const a = Math.floor(Math.random()*5*scale)+1;
      const b = Math.floor(Math.random()*10*scale)+1;
      const x = Math.floor(Math.random()*10)+1;
      const c = a*x + b;
      return { prompt: `Solve for x: \\(${a}x + ${b} = ${c}\\)`, choices: null, answer: x, type: "numeric" };
    }
    async explainAnswer(question, userAnswer){
      return `Solve: ${question.prompt}. The correct value is ${question.answer}.`;
    }
  })(),

  reading: new (class extends Module {
    constructor(){ super("reading","Reading","Comprehension, vocabulary, and fluency"); }
    async generateLesson(ctx){
      return `
        <div style="font-weight:700">Short Passage</div>
        <div class="small">Read and answer comprehension questions</div>
        <div style="margin-top:10px">
          <div style="background:rgba(255,255,255,0.02);padding:10px;border-radius:8px">
            <strong>Passage</strong>
            <p class="small">The river flowed quietly through the valley, carrying leaves and stories from upstream.</p>
          </div>
        </div>`;
    }
    async generateQuestion(difficulty){
      return { prompt: "What did the river carry?", choices: ["Rocks","Leaves and stories","Fish","Sand"], answer: 1, type: "mcq" };
    }
    async explainAnswer(question, userAnswer){ return `The passage says the river carried "leaves and stories", so that is the correct answer.`; }
  })(),

  science: new (class extends Module {
    constructor(){ super("science","Science","Life science, physical science, and inquiry"); }
    async generateLesson(ctx){ return `<div style="font-weight:700">Photosynthesis</div><div class="small">How plants convert light into energy</div>`; }
    async generateQuestion(difficulty){ return { prompt: "Which gas do plants take in for photosynthesis?", choices: ["Oxygen","Carbon Dioxide","Nitrogen","Hydrogen"], answer: 1, type: "mcq" }; }
    async explainAnswer(q,u){ return "Plants take in carbon dioxide to produce glucose and oxygen."; }
  })(),

  social: new (class extends Module {
    constructor(){ super("social","Social Studies","History, civics, geography, and culture"); }
    async generateLesson(){ return `<div style="font-weight:700">Local Geography</div><div class="small">Understanding maps and regions</div>`; }
    async generateQuestion(){ return { prompt: "What is a continent?", choices:["A country","A large landmass","A city","A river"], answer:1, type:"mcq" }; }
    async explainAnswer(){ return "A continent is a very large landmass such as Africa or Asia."; }
  })(),

  writing: new (class extends Module {
    constructor(){ super("writing","Writing","Grammar, structure, and creative writing"); }
    async generateLesson(){ return `<div style="font-weight:700">Paragraph Structure</div><div class="small">Topic sentence, supporting details, conclusion</div>`; }
    async generateQuestion(){ return { prompt: "Which sentence introduces the main idea?", choices:["Topic sentence","Supporting detail","Conclusion","Example"], answer:0, type:"mcq" }; }
    async explainAnswer(){ return "The topic sentence introduces the main idea of a paragraph."; }
  })()
};

// === UI Elements ===
const moduleListEl = document.getElementById("moduleList");
const moduleTitleEl = document.getElementById("moduleTitle");
const moduleSubtitleEl = document.getElementById("moduleSubtitle");
const moduleArea = document.getElementById("moduleArea");
const assistantOutput = document.getElementById("assistantOutput");
const assistantInput = document.getElementById("assistantInput");
const askBtn = document.getElementById("askBtn");
const speakBtn = document.getElementById("speakBtn");
const startLessonBtn = document.getElementById("startLessonBtn");
const startQuizBtn = document.getElementById("startQuizBtn");
const reviewBtn = document.getElementById("reviewBtn");
const analyticsMetrics = document.getElementById("analyticsMetrics");
const progressSummary = document.getElementById("progressSummary");
const uiLanguage = document.getElementById("uiLanguage");
const enableTTS = document.getElementById("enableTTS");
const difficultySelect = document.getElementById("difficulty");
const userNameEl = document.getElementById("userName");

// Quiz modal elements
const quizModal = document.getElementById("quizModal");
const qName = document.getElementById("qName");
const qSubjects = document.getElementById("qSubjects");
const qLevel = document.getElementById("qLevel");
const saveQuiz = document.getElementById("saveQuiz");
const closeQuiz = document.getElementById("closeQuiz");

// === Initialization ===
let activeModuleId = Object.keys(modules)[0];
function renderModuleList(){
  moduleListEl.innerHTML = "";
  for(const id of Object.keys(modules)){
    const btn = document.createElement("button");
    btn.className = "module-btn" + (id===activeModuleId ? " active" : "");
    btn.textContent = modules[id].title;
    btn.onclick = ()=>{ setActiveModule(id); };
    moduleListEl.appendChild(btn);
  }
}

function setActiveModule(id){
  activeModuleId = id;
  renderModuleList();
  moduleTitleEl.textContent = modules[id].title;
  moduleSubtitleEl.textContent = modules[id].description;
  renderLessonPlaceholder();
  saveState(state);
}

async function renderLessonPlaceholder(){
  const area = document.getElementById("lessonArea");
  area.innerHTML = "<div class='card small'>Loading lesson...</div>";
  const html = await modules[activeModuleId].generateLesson({ user: state.user });
  area.innerHTML = `<div class="card">${html}</div>`;
  const solBtn = area.querySelector('[data-action="show-solution"]');
  if(solBtn){
    solBtn.addEventListener("click", ()=>{
      const sol = document.getElementById("math-solution");
      if(sol) sol.style.display = sol.style.display === "none" ? "block" : "none";
      if(window.MathJax) MathJax.typesetPromise();
    });
  }
  if(window.MathJax) MathJax.typesetPromise();
}

// === Assistant ask flow ===
async function askAssistant(prompt){
  assistantOutput.textContent = "Thinking...";
  if(!AI_API_ENDPOINT || AI_API_KEY === "REPLACE_WITH_KEY"){
    const mod = modules[activeModuleId];
    const fallback = `Local assistant: I can help with ${mod.title}. Try "explain: ${prompt}" or "example: ${prompt}".`;
    assistantOutput.textContent = fallback;
    speakText(fallback);
    return fallback;
  }

  try {
    const payload = { prompt, module: activeModuleId, user: state.user, settings: { difficulty: state.settings.difficulty } };
    const res = await fetch(AI_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization": `Bearer ${AI_API_KEY}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const text = data?.text || "No response from AI.";
    assistantOutput.textContent = text;
    speakText(text);
    return text;
  } catch(err){
    assistantOutput.textContent = "Error contacting AI backend. See console.";
    console.error(err);
    return null;
  }
}

askBtn.addEventListener("click", ()=>{ const p = assistantInput.value.trim(); if(p) askAssistant(p); });
assistantInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ askBtn.click(); } });

// === Speech ===
function speakText(text){
  if(!enableTTS.checked) return;
  const lang = uiLanguage.value || "en";
  const ttsLang = LANGUAGE_MAP[lang]?.tts || "en-US";
  if('speechSynthesis' in window){
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = ttsLang;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }
}

speakBtn.addEventListener("click", async ()=>{
  if(!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)){
    assistantOutput.textContent = "Speech recognition not supported in this browser.";
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SpeechRecognition();
  rec.lang = LANGUAGE_MAP[uiLanguage.value]?.tts || "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  assistantOutput.textContent = "Listening...";
  rec.onresult = (e)=>{ assistantInput.value = e.results[0][0].transcript; assistantOutput.textContent = "Captured voice input."; };
  rec.onerror = (e)=>{ assistantOutput.textContent = "Speech recognition error."; };
  rec.onend = ()=>{ assistantOutput.textContent = "Listening ended."; };
  rec.start();
});

// === Quiz Engine ===
async function runQuiz(rounds=5){
  const mod = modules[activeModuleId];
  const difficulty = state.settings.difficulty === "auto" ? (qLevel.value || "intermediate") : state.settings.difficulty;
  let correct = 0;
  for(let i=0;i<rounds;i++){
    const q = await mod.generateQuestion(difficulty);
    const userAnswer = await presentQuestion(q);
    const isCorrect = evaluateAnswer(q, userAnswer);
    if(isCorrect) correct++;
    state.progress[activeModuleId] = state.progress[activeModuleId] || { attempts:0, correct:0 };
    state.progress[activeModuleId].attempts++;
    if(isCorrect) state.progress[activeModuleId].correct++;
    if(!isCorrect) state.reviewQueue.push({ module: activeModuleId, question: q, due: Date.now() + 1000*60*60*24 });
    const explanation = await mod.explainAnswer(q, userAnswer);
    assistantOutput.textContent = `Q${i+1}: ${q.prompt} — Your answer: ${userAnswer} — ${isCorrect ? "Correct" : "Incorrect"}\nExplanation: ${explanation}`;
    speakText(explanation);
    await new Promise(r=>setTimeout(r, 900));
  }
  saveState(state);
  updateAnalytics();
  alert(`Quiz complete. Score: ${correct}/${rounds}`);
}

function evaluateAnswer(q, userAnswer){
  if(q.type === "mcq") return Number(userAnswer) === Number(q.answer);
  if(q.type === "numeric") return Number(userAnswer) === Number(q.answer);
  return false;
}

function presentQuestion(q){
  return new Promise((resolve)=>{
    if(q.type === "mcq"){
      const choices = q.choices.map((c,i)=>`${i+1}. ${c}`).join("\n");
      const ans = prompt(`${q.prompt}\n\n${choices}\n\nEnter choice number`);
      resolve((Number(ans)-1).toString());
    } else {
      const ans = prompt(`${q.prompt}\n\nEnter your numeric answer`);
      resolve(ans);
    }
  });
}

// === Review Queue ===
async function reviewQueue(){
  if(!state.reviewQueue.length){ alert("No items in review queue."); return; }
  const now = Date.now();
  const due = state.reviewQueue.filter(i=>i.due <= now);
  if(!due.length){ alert("No items due for review yet."); return; }
  for(const item of due){
    const q = item.question;
    const ans = await presentQuestion(q);
    const ok = evaluateAnswer(q, ans);
    if(ok){ item.due = now + 1000*60*60*24*3; } else { item.due = now + 1000*60*60*24; }
  }
  saveState(state);
  updateAnalytics();
  alert("Review session complete.");
}

// === Analytics ===
function updateAnalytics(){
  analyticsMetrics.innerHTML = "";
  for(const id of Object.keys(modules)){
    const p = state.progress[id] || { attempts:0, correct:0 };
    const acc = p.attempts ? Math.round((p.correct/p.attempts)*100) + "%" : "—";
    const el = document.createElement("div");
    el.className = "metric";
    el.innerHTML = `<div style="font-weight:700">${modules[id].title}</div><div class="small">Attempts: ${p.attempts} • Accuracy: ${acc}</div>`;
    analyticsMetrics.appendChild(el);
  }
  progressSummary.textContent = `Review queue: ${state.reviewQueue.length} items`;
  userNameEl.textContent = state.user.name || "Student";
}

// === Initial Quiz Handling ===
function showInitialQuizIfNeeded(){
  if(state.user && state.user.initialized) return;
  quizModal.style.display = "flex";
  qName.value = state.user.name || "";
  quizModal.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked = false);
}

saveQuiz.addEventListener("click", ()=>{
  const name = qName.value.trim() || "Student";
  const selected = Array.from(qSubjects.querySelectorAll('input[type="checkbox"]:checked')).map(i=>i.value);
  const level = qLevel.value;
  state.user.name = name;
  state.user.language = uiLanguage.value;
  state.user.initialized = true;
  state.user.focus = selected.slice(0,3);
  state.user.level = level;
  if(state.user.focus && state.user.focus.length) setActiveModule(state.user.focus[0]);
  quizModal.style.display = "none";
  saveState(state);
  updateAnalytics();
  renderModuleList();
  renderLessonPlaceholder();
});

closeQuiz.addEventListener("click", ()=>{
  state.user.initialized = true;
  quizModal.style.display = "none";
  saveState(state);
});

// === Event bindings ===
startLessonBtn.addEventListener("click", ()=>{ renderLessonPlaceholder(); });
startQuizBtn.addEventListener("click", ()=>{ runQuiz(5); });
reviewBtn.addEventListener("click", ()=>{ reviewQueue(); });

uiLanguage.addEventListener("change", ()=>{
  state.user.language = uiLanguage.value;
  saveState(state);
});
enableTTS.addEventListener("change", ()=>{ state.user.ttsEnabled = enableTTS.checked; saveState(state); });
difficultySelect.addEventListener("change", ()=>{ state.settings.difficulty = difficultySelect.value; saveState(state); });

// === Boot ===
renderModuleList();
setActiveModule(activeModuleId);
updateAnalytics();
showInitialQuizIfNeeded();

// Expose API for extensions
window.AI_Edu = {
  registerModule: (id, moduleInstance) => { modules[id] = moduleInstance; renderModuleList(); },
  getState: ()=>state,
  saveState: ()=>saveState(state)
};

// Accessibility: keyboard shortcut to open assistant input (press /)
window.addEventListener("keydown", (e)=>{ if(e.key === "/"){ assistantInput.focus(); e.preventDefault(); } });
```

