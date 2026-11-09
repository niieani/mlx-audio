"use client"

import { useState, useRef } from "react"
import { ChevronDown, Download, ThumbsUp, ThumbsDown, Play, Pause, RefreshCw } from "lucide-react"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { RangeInput } from "@/components/range-input"
import {
  CUSTOM_TTS_MODEL_VALUE,
  TTS_MODEL_PRESETS,
  type ResponseFormat,
  buildTTSRequestPayload,
  getAvailableQuantizations,
  getDefaultVoiceForModel,
  getDefaultVoiceMatchForModel,
  isCustomModelSelection,
  isMarvisModel,
  isMisoModel,
  resolveTTSModel,
} from "@/lib/tts-models"

export default function SpeechSynthesis() {
  const [text, setText] = useState("But I also have other interests, such as playing tic-tac-toe.")
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [currentTime, setCurrentTime] = useState("00:00")
  const [duration, setDuration] = useState("00:04")
  const [activeTab, setActiveTab] = useState<"settings" | "history">("settings")
  const [baseModel, setBaseModel] = useState("Marvis-AI/marvis-tts-100m-v0.2")
  const [customModel, setCustomModel] = useState("")
  const [quantization, setQuantization] = useState("6bit")
  const [liked, setLiked] = useState<boolean | null>(null)
  const [selectedVoice, setSelectedVoice] = useState("conversational_a")
  const [speaker, setSpeaker] = useState(0)
  const [voiceMatch, setVoiceMatch] = useState(true)
  const [gender, setGender] = useState("male")
  const [refAudio, setRefAudio] = useState("")
  const [refText, setRefText] = useState("")
  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(0.95)
  const [topK, setTopK] = useState(40)
  const [repetitionPenalty, setRepetitionPenalty] = useState(1)
  const [maxTokens, setMaxTokens] = useState(1200)
  const [maxAudioLengthMs, setMaxAudioLengthMs] = useState("")
  const [responseFormat, setResponseFormat] = useState<ResponseFormat>("mp3")
  const language = "English-detected"

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const model = resolveTTSModel(baseModel, quantization, customModel)
  const modelReady = model.length > 0

  const applyModelDefaults = (modelName: string) => {
    const defaultVoice = getDefaultVoiceForModel(modelName)
    setSelectedVoice(defaultVoice || "")
    setVoiceMatch(getDefaultVoiceMatchForModel(modelName))
    if (isMisoModel(modelName)) {
      setTemperature(0.9)
      setTopP(0)
      setTopK(50)
    } else {
      setTemperature(0.7)
      setTopP(0.95)
      setTopK(40)
    }
  }

  const handleModelChange = (newModel: string) => {
    setBaseModel(newModel)
    if (isMarvisModel(newModel)) {
      const availableQuants = getAvailableQuantizations(newModel)
      if (availableQuants.includes("6bit")) {
        setQuantization("6bit")
      } else if (availableQuants.length > 0) {
        setQuantization(availableQuants[0])
      }
    }
    applyModelDefaults(newModel === CUSTOM_TTS_MODEL_VALUE ? customModel : newModel)
  }

  const handlePlayPause = () => {
    if (!audioRef.current || !audioRef.current.src || audioRef.current.src === window.location.href) {
      handleGenerate()
      return
    }

    if (isPlaying) {
      audioRef.current?.pause()
    } else {
      audioRef.current?.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleGenerate = async () => {
    if (!audioRef.current || !modelReady) return
    setIsGenerating(true)

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost';
    const API_PORT = process.env.NEXT_PUBLIC_API_PORT || '8000';

    const parsedMaxAudioLengthMs = maxAudioLengthMs.trim()
      ? Number.parseInt(maxAudioLengthMs, 10)
      : undefined

    try {
      const response = await fetch(`${API_BASE_URL}:${API_PORT}/v1/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildTTSRequestPayload({
            model,
            input: text,
            voice: selectedVoice,
            speed,
            pitch,
            gender,
            speaker,
            voiceMatch,
            refAudio,
            refText,
            temperature,
            topP,
            topK,
            repetitionPenalty,
            maxTokens,
            maxAudioLengthMs: Number.isFinite(parsedMaxAudioLengthMs)
              ? parsedMaxAudioLengthMs
              : undefined,
            responseFormat,
          })
        ),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const audioUrl = URL.createObjectURL(blob)
      audioRef.current.src = audioUrl

      audioRef.current.onloadedmetadata = () => {
        setDuration(formatTime(Math.floor(audioRef.current?.duration || 0)))
        setCurrentTime("00:00")
        audioRef.current
          ?.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false))
      }

      audioRef.current.ontimeupdate = () => {
        setCurrentTime(formatTime(Math.floor(audioRef.current?.currentTime || 0)))
      }

      audioRef.current.onended = () => {
        setIsPlaying(false)
        setCurrentTime("00:00")
        if (audioRef.current?.src.startsWith("blob:")) {
          URL.revokeObjectURL(audioRef.current.src)
        }
      }
    } catch (error) {
      console.error("Error generating speech:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    alert("Downloading audio...")
  }

  const handleFeedback = (isPositive: boolean) => {
    setLiked(isPositive)
  }

  const formatTime = (seconds: number) => {
    return `00:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <LayoutWrapper activeTab="audio" activePage="text-to-speech">
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto border-r border-gray-200 dark:border-gray-700 p-6">
          <h1 className="mb-6 text-2xl font-bold">Speech Synthesis</h1>
          <textarea
            className="min-h-[200px] w-full resize-none rounded-md border border-gray-200 dark:border-gray-700 p-4 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:border-blue-500 focus:outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
          />
          <div className="mt-auto flex items-center justify-between pt-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <span>Long Text</span>
              <div className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500"></div>
            </div>
            <div className="flex items-center space-x-2">
              <span>{text.length} / 5,000 characters</span>
              <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-600"></div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <button className="flex items-center space-x-1 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span>{language}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <button
                className="rounded-md border border-gray-200 dark:border-gray-700 p-1 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                className={`rounded-md bg-sky-500 dark:bg-sky-600 px-3 py-1 text-sm text-white flex items-center hover:bg-sky-600 dark:hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 ${isGenerating ? "animate-pulse" : ""}`}
                onClick={handleGenerate}
                disabled={isGenerating || !modelReady}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="w-80 overflow-auto p-4 bg-white dark:bg-gray-900">
          <div className="mb-4 flex space-x-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            <button
              className={`pb-2 text-sm ${activeTab === "settings" ? "border-b-2 border-black dark:border-white font-medium" : "text-gray-500 dark:text-gray-400"}`}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </button>
            <button
              className={`pb-2 text-sm ${activeTab === "history" ? "border-b-2 border-black dark:border-white font-medium" : "text-gray-500 dark:text-gray-400"}`}
              onClick={() => setActiveTab("history")}
            >
              History
            </button>
          </div>

          {activeTab === "settings" ? (
            <>
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm">Model</span>
                  <div className="relative">
                    <select
                      className="flex w-40 appearance-none items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm pr-8 bg-white dark:bg-gray-800"
                      value={baseModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                    >
                      {TTS_MODEL_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-2 h-4 w-4 pointer-events-none" />
                  </div>
                </div>
              </div>

              {isCustomModelSelection(baseModel) && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm" htmlFor="custom-tts-model">
                    Model path or repo
                  </label>
                  <input
                    id="custom-tts-model"
                    className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    value={customModel}
                    onChange={(e) => {
                      setCustomModel(e.target.value)
                      applyModelDefaults(e.target.value)
                    }}
                    placeholder="mlx-community/MisoTTS-8bit or a local model folder"
                  />
                </div>
              )}

              {isMarvisModel(baseModel) && (
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm">Quantization</span>
                    <div className="relative">
                      <select
                        className="flex w-40 appearance-none items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm pr-8 bg-white dark:bg-gray-800"
                        value={quantization}
                        onChange={(e) => setQuantization(e.target.value)}
                      >
                        {getAvailableQuantizations(baseModel).map((quant) => (
                          <option key={quant} value={quant}>
                            {quant === "none" ? "None (bf16)" : quant.replace("bit", "-bit")}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-2 h-4 w-4 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium">Selected Model:</span> <span className="font-mono break-all">{model || "None"}</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="mb-2 block text-sm" htmlFor="tts-voice">
                  Voice
                </label>
                <input
                  id="tts-voice"
                  className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  placeholder={getDefaultVoiceForModel(model) || "Default"}
                />
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3">
                <label className="block text-sm" htmlFor="tts-speaker">
                  Speaker
                  <input
                    id="tts-speaker"
                    type="number"
                    min={0}
                    step={1}
                    className="mt-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    value={speaker}
                    onChange={(e) => setSpeaker(Number.parseInt(e.target.value, 10) || 0)}
                  />
                </label>
                <label className="block text-sm" htmlFor="tts-gender">
                  Gender
                  <select
                    id="tts-gender"
                    className="mt-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
              </div>

              <div className="mb-6 flex items-center justify-between">
                <label className="text-sm" htmlFor="tts-voice-match">
                  Voice match
                </label>
                <input
                  id="tts-voice-match"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={voiceMatch}
                  onChange={(e) => setVoiceMatch(e.target.checked)}
                />
              </div>

              <div className="mb-6">
                <label className="mb-2 block text-sm" htmlFor="tts-ref-audio">
                  Reference audio
                </label>
                <input
                  id="tts-ref-audio"
                  className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                  value={refAudio}
                  onChange={(e) => setRefAudio(e.target.value)}
                  placeholder="/path/to/reference.wav"
                />
              </div>

              <div className="mb-6">
                <label className="mb-2 block text-sm" htmlFor="tts-ref-text">
                  Reference text
                </label>
                <textarea
                  id="tts-ref-text"
                  className="min-h-20 w-full resize-none rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                  value={refText}
                  onChange={(e) => setRefText(e.target.value)}
                />
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm">Speed</span>
                  <div className="flex items-center">
                    <div className="flex space-x-2 mr-2">
                      <button
                        onClick={() => setSpeed(0.5)}
                        className={`px-2 py-0.5 text-xs rounded-md ${speed === 0.5 ? "bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                      >
                        0.5x
                      </button>
                      <button
                        onClick={() => setSpeed(1)}
                        className={`px-2 py-0.5 text-xs rounded-md ${speed === 1 ? "bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                      >
                        1x
                      </button>
                      <button
                        onClick={() => setSpeed(1.5)}
                        className={`px-2 py-0.5 text-xs rounded-md ${speed === 1.5 ? "bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                      >
                        1.5x
                      </button>
                    </div>
                    <span className="text-sm font-medium">{speed}x</span>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 mr-2">Slow</span>
                  <RangeInput
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={speed}
                    onChange={(e) => setSpeed(Number.parseFloat(e.target.value))}
                    ariaLabel="Speed control"
                  />
                  <span className="text-xs text-gray-500 ml-2">Fast</span>
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm">Pitch</span>
                  <div className="flex items-center">
                    <div className="flex space-x-2 mr-2">
                      <button
                        onClick={() => setPitch(0.8)}
                        className={`px-2 py-0.5 text-xs rounded-md ${pitch === 0.8 ? "bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                      >
                        Low
                      </button>
                      <button
                        onClick={() => setPitch(1)}
                        className={`px-2 py-0.5 text-xs rounded-md ${pitch === 1 ? "bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                      >
                        Normal
                      </button>
                      <button
                        onClick={() => setPitch(1.2)}
                        className={`px-2 py-0.5 text-xs rounded-md ${pitch === 1.2 ? "bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
                      >
                        High
                      </button>
                    </div>
                    <span className="text-sm font-medium">{pitch.toFixed(1)}x</span>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 mr-2">Low</span>
                  <RangeInput
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={pitch}
                    onChange={(e) => setPitch(Number.parseFloat(e.target.value))}
                    ariaLabel="Pitch control"
                  />
                  <span className="text-xs text-gray-500 ml-2">High</span>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3">
                <label className="block text-sm" htmlFor="tts-temperature">
                  Temperature
                  <input
                    id="tts-temperature"
                    type="number"
                    min={0}
                    max={2}
                    step={0.05}
                    className="mt-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    value={temperature}
                    onChange={(e) => setTemperature(Number.parseFloat(e.target.value))}
                  />
                </label>
                <label className="block text-sm" htmlFor="tts-top-p">
                  Top P
                  <input
                    id="tts-top-p"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    className="mt-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    value={topP}
                    onChange={(e) => setTopP(Number.parseFloat(e.target.value))}
                  />
                </label>
                <label className="block text-sm" htmlFor="tts-top-k">
                  Top K
                  <input
                    id="tts-top-k"
                    type="number"
                    min={0}
                    step={1}
                    className="mt-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    value={topK}
                    onChange={(e) => setTopK(Number.parseInt(e.target.value, 10) || 0)}
                  />
                </label>
                <label className="block text-sm" htmlFor="tts-repetition-penalty">
                  Repetition
                  <input
                    id="tts-repetition-penalty"
                    type="number"
                    min={0}
                    step={0.05}
                    className="mt-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    value={repetitionPenalty}
                    onChange={(e) => setRepetitionPenalty(Number.parseFloat(e.target.value))}
                  />
                </label>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3">
                <label className="block text-sm" htmlFor="tts-max-tokens">
                  Max tokens
                  <input
                    id="tts-max-tokens"
                    type="number"
                    min={1}
                    step={1}
                    className="mt-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number.parseInt(e.target.value, 10) || 1)}
                  />
                </label>
                <label className="block text-sm" htmlFor="tts-max-audio-ms">
                  Max audio ms
                  <input
                    id="tts-max-audio-ms"
                    type="number"
                    min={80}
                    step={80}
                    className="mt-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    value={maxAudioLengthMs}
                    onChange={(e) => setMaxAudioLengthMs(e.target.value)}
                  />
                </label>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm" htmlFor="tts-response-format">
                  Format
                </label>
                <select
                  id="tts-response-format"
                  className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                  value={responseFormat}
                  onChange={(e) => setResponseFormat(e.target.value as ResponseFormat)}
                >
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                  <option value="flac">FLAC</option>
                  <option value="ogg">OGG</option>
                  <option value="opus">Opus</option>
                </select>
              </div>
            </>
          ) : (
            <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>No history available</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 w-full">
        <div className="flex items-center w-full px-0">
          <button
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 ml-4"
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>

          <div className="flex flex-col justify-between h-full flex-1 px-4 py-2">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm">
                {selectedVoice || "Default"}: {text.length > 20 ? text.substring(0, 20) + "..." : text}
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mr-2">How did this sound?</div>
                <button
                  className="rounded-md border border-gray-200 dark:border-gray-700 p-1 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => handleFeedback(true)}
                >
                  <ThumbsUp
                    className={`h-4 w-4 ${liked === true ? "text-sky-500" : "text-gray-500 dark:text-gray-400"}`}
                  />
                </button>
                <button
                  className="rounded-md border border-gray-200 dark:border-gray-700 p-1 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => handleFeedback(false)}
                >
                  <ThumbsDown
                    className={`h-4 w-4 ${liked === false ? "text-sky-500" : "text-gray-500 dark:text-gray-400"}`}
                  />
                </button>
                <button
                  className="rounded-md border border-gray-200 dark:border-gray-700 p-1 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="flex items-center mt-2">
              <div
                className="flex-1 bg-gray-200 dark:bg-gray-700 h-1 rounded-full cursor-pointer relative"
                onClick={(e) => {
                  if (!audioRef.current || !audioRef.current.duration) return
                  const bar = e.currentTarget
                  const rect = bar.getBoundingClientRect()
                  const position = (e.clientX - rect.left) / rect.width
                  audioRef.current.currentTime = position * audioRef.current.duration
                  setCurrentTime(formatTime(Math.floor(audioRef.current.currentTime)))
                }}
              >
                <div
                  className="bg-black dark:bg-white h-1 rounded-full absolute top-0 left-0"
                  style={{
                    width: audioRef.current?.duration
                      ? `${(audioRef.current.currentTime / audioRef.current.duration) * 100}%`
                      : "0%",
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 ml-4 whitespace-nowrap mr-4">
                {currentTime} / {duration}
              </div>
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} className="hidden" />
    </LayoutWrapper>
  )
}
