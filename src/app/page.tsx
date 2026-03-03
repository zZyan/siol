"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Settings, History, ExternalLink, RefreshCw, Loader2, StopCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";

declare global {
  interface Window {
    ai?: {
      canCreateTextSession: () => Promise<string>;
      createTextSession: () => Promise<any>;
    };
    documentPictureInPicture?: any;
  }
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("main"); // main, history

  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [workerProgress, setWorkerProgress] = useState(0);
  const [workerStatus, setWorkerStatus] = useState("init");

  // AI Correction state
  const [isFixing, setIsFixing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<"rating" | "input">("rating");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [correctionHistory, setCorrectionHistory] = useState<{ id: number; text: string; feedback?: string }[]>([]);
  const [localVocabulary, setLocalVocabulary] = useState<string[]>([]);

  // PiP State
  const [isPipActive, setIsPipActive] = useState(false);
  const pipWindowRef = useRef<any>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKey(savedKey);

    const savedHistory = localStorage.getItem("correction_history");
    if (savedHistory) setCorrectionHistory(JSON.parse(savedHistory));

    const savedVocab = localStorage.getItem("local_vocabulary");
    if (savedVocab) setLocalVocabulary(JSON.parse(savedVocab));
  }, []);

  // Web Worker for Transformers.js
  useEffect(() => {
    if (typeof window !== "undefined") {
      workerRef.current = new Worker(new URL("../workers/whisper.worker.ts", import.meta.url), {
        type: "module",
      });

      workerRef.current.onmessage = (e) => {
        const { status, text, progress } = e.data;
        if (status === "progress") {
          setWorkerProgress(progress);
          setWorkerStatus("loading");
        } else if (status === "ready") {
          setWorkerStatus("ready");
        } else if (status === "complete") {
          setTranscription((prev) => (prev ? prev + " " + text : text).trim());
          setIsProcessing(false);
        } else if (status === "error") {
          console.error("Worker error:", e.data);
          setIsProcessing(false);
        }
      };
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const saveApiKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem("gemini_api_key", key);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required for dictation.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      let audioData = audioBuffer.getChannelData(0);

      if (workerRef.current) {
         workerRef.current.postMessage({ type: 'generate', audio: audioData });
      } else {
         console.error("Worker not initialized");
         setIsProcessing(false);
      }
    } catch (error) {
       console.error("Error processing audio", error);
       setIsProcessing(false);
    }
  };

  const finalizeText = (text: string) => {
    setTranscription(text);
    navigator.clipboard.writeText(text);
    setShowFeedback(true);
    setFeedbackMode("rating");

    // Auto hide feedback after 5 seconds if not interacted
    setTimeout(() => {
        setShowFeedback(false);
    }, 5000);
  };

  const fixText = async () => {
    if (!transcription.trim()) return;
    setIsFixing(true);

    const vocabContext = localVocabulary.length > 0
        ? `\n\nUse this local vocabulary to correct specific terms: ${localVocabulary.join(", ")}`
        : "";

    const promptText = `Clean up this voice-to-text dictation, fixing typos, grammar, and formatting. Return ONLY the fixed text, without any conversational filler or quotes.${vocabContext}\n\nText: ${transcription}`;

    try {
        // 1. Try Local Model First (window.ai - Gemini Nano)
        if (window.ai) {
            const status = await window.ai.canCreateTextSession();
            if (status === "readily") {
                const session = await window.ai.createTextSession();
                const result = await session.prompt(promptText);
                finalizeText(result);
                setIsFixing(false);
                return;
            }
        }

        // 2. Fallback to Gemini 3 Flash API
        if (!apiKey) {
            throw new Error("Local AI unavailable and no API key provided for fallback.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // using 1.5 flash as it's the current accessible one

        const result = await model.generateContent(promptText);
        const responseText = result.response.text();
        finalizeText(responseText.trim());

    } catch (error) {
        console.error("AI correction failed:", error);
        alert("Failed to fix text. Please check your API key or connection.");
    } finally {
        setIsFixing(false);
    }
  };

  const handleFeedback = (rating: "up" | "down") => {
      if (rating === "up") {
          setShowFeedback(false);
      } else {
          setFeedbackMode("input");
      }
  };

  const submitFeedback = () => {
      if (!feedbackInput.trim()) return;

      const newHistoryItem = {
          id: Date.now(),
          text: transcription,
          feedback: feedbackInput
      };

      const newHistory = [newHistoryItem, ...correctionHistory].slice(0, 20); // keep last 20
      setCorrectionHistory(newHistory);
      localStorage.setItem("correction_history", JSON.stringify(newHistory));

      const newVocab = [...localVocabulary, feedbackInput].filter((v, i, a) => a.indexOf(v) === i);
      setLocalVocabulary(newVocab);
      localStorage.setItem("local_vocabulary", JSON.stringify(newVocab));

      setFeedbackInput("");
      setShowFeedback(false);
  };

  const togglePip = async () => {
    if (!("documentPictureInPicture" in window)) {
        alert("Document Picture-in-Picture API is not supported in your browser.");
        return;
    }

    if (isPipActive && pipWindowRef.current) {
        pipWindowRef.current.close();
        return;
    }

    try {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 320,
            height: 480,
        });

        pipWindowRef.current = pipWindow;
        setIsPipActive(true);

        // Copy styles to the PiP window
        [...document.styleSheets].forEach((styleSheet) => {
            try {
                const cssRules = [...styleSheet.cssRules]
                    .map((rule) => rule.cssText)
                    .join("");
                const style = document.createElement("style");
                style.textContent = cssRules;
                pipWindow.document.head.appendChild(style);
            } catch (e) {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.type = styleSheet.type;
                link.media = styleSheet.media.mediaText;
                link.href = styleSheet.href!;
                pipWindow.document.head.appendChild(link);
            }
        });

        // Move the main content to the PiP window
        if (mainContentRef.current) {
            pipWindow.document.body.appendChild(mainContentRef.current);
            pipWindow.document.body.classList.add('bg-gray-900', 'text-gray-100'); // Ensure background is set
        }

        // Handle PiP close
        pipWindow.addEventListener("pagehide", () => {
            setIsPipActive(false);
            pipWindowRef.current = null;
            // Move content back to original window
            if (mainContentRef.current) {
                document.getElementById('pip-container')?.appendChild(mainContentRef.current);
            }
        });

    } catch (error) {
        console.error("Failed to enter PiP mode:", error);
        alert("Failed to enter PiP mode.");
    }
  };


  return (
    <main className="flex flex-col h-screen max-w-md mx-auto relative bg-gray-900 overflow-hidden" id="pip-container">
      {/* Content to be moved to PiP */}
      <div ref={mainContentRef} className="flex flex-col h-full w-full">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0 bg-gray-900">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            SIOL
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab(activeTab === "history" ? "main" : "history")}
              className={`transition ${activeTab === 'history' ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              <History size={20} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`transition ${showSettings ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute top-16 right-4 left-4 z-10 bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-xl animate-in fade-in slide-in-from-top-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={saveApiKey}
              placeholder="AIzaSy..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3"
            />
            <p className="text-xs text-gray-400">
              Fallback for cloud logic. Your API key is stored safely in localStorage.
            </p>
            <button
               onClick={() => setShowSettings(false)}
               className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm transition"
            >
               Done
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col relative bg-gray-900">
          {activeTab === "main" ? (
            <>
              {/* Onboarding / Guide */}
              {!apiKey && workerStatus !== "loading" && transcription.length === 0 && (
                <div className="bg-blue-900/20 border border-blue-900/50 rounded-xl p-4 mb-6 text-sm text-blue-200">
                  <h3 className="font-semibold mb-2">Welcome to SIOL!</h3>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Enter your Gemini API key in Settings.</li>
                    <li>Tap the Mic to dictate.</li>
                    <li>Hit Fix to clean it up and Auto-Copy!</li>
                  </ol>
                </div>
              )}

              {workerStatus === "loading" && (
                 <div className="bg-purple-900/20 border border-purple-900/50 rounded-xl p-4 mb-6 text-sm text-purple-200">
                   <p className="flex items-center gap-2">
                     <Loader2 className="animate-spin" size={16} />
                     Downloading transcription model ({(workerProgress).toFixed(0)}%)...
                   </p>
                 </div>
              )}

              {/* Transcription Area */}
              <div className={`flex-1 bg-gray-800/50 border ${isFixing ? 'border-blue-500/50 animate-pulse' : 'border-gray-700'} rounded-2xl p-4 flex flex-col relative mb-4 transition-colors`}>
                <textarea
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="Your dictated text will appear here..."
                  disabled={isFixing}
                  className="w-full h-full bg-transparent resize-none outline-none text-gray-100 placeholder-gray-500 leading-relaxed disabled:opacity-70"
                />
                <div className="absolute bottom-4 right-4 text-xs font-medium text-gray-500">
                  {transcription.length > 0 && !isFixing && "Ready to Fix"}
                  {isFixing && <span className="text-blue-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> AI Fixing...</span>}
                </div>
              </div>

              {/* Feedback Toast */}
              {showFeedback && (
                  <div className="absolute bottom-28 left-4 right-4 bg-gray-800 border border-gray-600 p-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 z-20">
                      {feedbackMode === "rating" ? (
                          <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-200">Copied! Was it perfect?</span>
                              <div className="flex gap-2">
                                  <button onClick={() => handleFeedback("up")} className="p-2 bg-gray-700 hover:bg-green-900/50 hover:text-green-400 rounded-lg transition"><ThumbsUp size={18} /></button>
                                  <button onClick={() => handleFeedback("down")} className="p-2 bg-gray-700 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition"><ThumbsDown size={18} /></button>
                              </div>
                          </div>
                      ) : (
                          <div className="flex flex-col gap-2">
                              <span className="text-sm font-medium text-gray-200">What was wrong?</span>
                              <input
                                  autoFocus
                                  type="text"
                                  value={feedbackInput}
                                  onChange={(e) => setFeedbackInput(e.target.value)}
                                  placeholder="e.g., 'It's spelled SIOL, not Seoul'"
                                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                  <button onClick={() => setShowFeedback(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                                  <button onClick={submitFeedback} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg">Teach AI</button>
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* Controls */}
              <div className="flex justify-center items-center gap-6 py-4 shrink-0 bg-gray-900">
                <button
                  onClick={togglePip}
                  className={`p-4 rounded-full transition shadow-lg border border-gray-700 text-white
                    ${isPipActive ? 'bg-blue-900/50 border-blue-500/50 text-blue-400' : 'bg-gray-800 hover:bg-gray-700'}
                  `}
                  title={isPipActive ? "Close PiP" : "Pop Out (PiP)"}
                >
                  <ExternalLink size={24} />
                </button>

                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={workerStatus === "loading" || isProcessing || isFixing}
                  className={`p-6 rounded-full transition shadow-lg relative flex items-center justify-center
                    ${isRecording
                      ? "bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                      : "bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]"}
                    ${(workerStatus === "loading" || isProcessing || isFixing) ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  {isProcessing && <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />}

                  {isRecording ? <StopCircle size={32} /> : <Mic size={32} />}

                  {isRecording && (
                     <div className="absolute -inset-2 bg-red-500/20 rounded-full animate-ping z-[-1]"></div>
                  )}
                </button>

                <button
                  onClick={fixText}
                  disabled={transcription.length === 0 || isFixing || isRecording || isProcessing}
                  className={`bg-gray-800 hover:bg-gray-700 text-white p-4 rounded-full transition shadow-lg border border-gray-700
                     ${(transcription.length === 0 || isFixing || isRecording || isProcessing) ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500/50 hover:text-blue-400'}
                  `}
                  title="Fix Text"
                >
                  <RefreshCw size={24} className={isFixing ? 'animate-spin' : ''} />
                </button>
              </div>
            </>
          ) : (
            /* History / Vocabulary Tab */
            <div className="flex-1 flex flex-col">
              <h2 className="text-lg font-semibold mb-4 text-gray-200">Correction History & Vocabulary</h2>

              {localVocabulary.length > 0 && (
                  <div className="mb-6">
                      <h3 className="text-sm font-medium text-blue-400 mb-2">Learned Vocabulary</h3>
                      <div className="flex flex-wrap gap-2">
                          {localVocabulary.map((vocab, i) => (
                              <span key={i} className="bg-blue-900/30 text-blue-300 border border-blue-800 px-2 py-1 rounded text-xs">
                                  {vocab}
                              </span>
                          ))}
                      </div>
                  </div>
              )}

              <h3 className="text-sm font-medium text-gray-400 mb-2">Recent Feedback</h3>
              <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                  {correctionHistory.length === 0 ? (
                      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-400 text-center">
                      No manual corrections saved yet.
                      </div>
                  ) : (
                      correctionHistory.map((item) => (
                          <div key={item.id} className="bg-gray-800/80 border border-gray-700 rounded-lg p-3 text-sm">
                              <p className="text-gray-300 line-clamp-2 italic">"{item.text}"</p>
                              <div className="mt-2 flex items-start gap-2 text-blue-300 bg-blue-900/20 p-2 rounded">
                                  <span className="font-semibold text-xs shrink-0 mt-0.5">Note:</span>
                                  <span className="text-xs">{item.feedback}</span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Overlay when PiP is active */}
      {isPipActive && (
        <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center flex-col">
           <ExternalLink size={48} className="text-blue-500 mb-4 opacity-80" />
           <p className="text-lg font-medium text-gray-200">Running in PiP Mode</p>
           <p className="text-sm text-gray-500 mt-2">Close the floating window to return.</p>
           <button
              onClick={togglePip}
              className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
           >
              Bring Back Here
           </button>
        </div>
      )}
    </main>
  );
}