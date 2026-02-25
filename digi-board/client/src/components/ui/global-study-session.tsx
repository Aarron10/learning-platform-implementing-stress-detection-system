import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BrainCircuit, Activity, Eye, Play, Square, Coffee, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = "http://localhost:8000";

export function GlobalStudySession() {
    const { user } = useAuth();
    const [isActive, setIsActive] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [state, setState] = useState<{
        classification: string;
        focus: number;
        stress: number;
        distraction: number;
    }>({ classification: "Offline", focus: 0, stress: 0, distraction: 0 });

    // New Pause State
    const [isPaused, setIsPaused] = useState(false);

    // Timer states
    const [selectedDuration, setSelectedDuration] = useState<string>("30"); // Target duration in minutes
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // Seconds remaining

    const [showBreakModal, setShowBreakModal] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);

    const pollingInterval = useRef<NodeJS.Timeout | null>(null);
    const timerInterval = useRef<NodeJS.Timeout | null>(null);
    const consecutiveStressTicks = useRef(0);
    const STRESS_THRESHOLD = 0.70;
    const REQUIRED_TICKS_FOR_BREAK = 20; // 20 ticks * 3s = 60s
    const sessionIdRef = useRef<number | null>(null);

    // Format seconds into MM:SS
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // 1. Start AI Proctor Session
    const handleStart = async () => {
        setIsStarting(true);
        try {
            // Tell FastAPI to start the camera and models
            const response = await fetch(`${API_BASE_URL}/start_monitoring`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.status === "started" || data.status === "already_running") {
                setIsActive(true);
                setTimeRemaining(parseInt(selectedDuration) * 60);
                toast.success("Study Session Started");

                // Register session in our Digi-board DB (no assignment ID since it's global)
                try {
                    const sessionRes = await apiRequest("POST", "/api/study-sessions/start", {});
                    const sessionData = await sessionRes.json();
                    sessionIdRef.current = sessionData.id;
                } catch (dbErr: any) {
                    console.warn("Could not save study session start to DB, continuing anyway", dbErr);
                    toast.error("Warning: Could not connect to database to save session progress.");
                }

                setIsPaused(false);
                startPolling();
                startTimer();
                // do NOT close the popover here immediately so the user can see the timer start
            }
        } catch (error: any) {
            console.error("Session Start Error Details:", error);
            toast.error(`Error: ${error.message || "Unknown error"}. Make sure servers are running.`);
            setIsActive(false);
            setTimeRemaining(null);
            // In case the camera actually started but JS threw later, force a stop!
            fetch(`${API_BASE_URL}/stop_monitoring`, { method: 'POST' }).catch(() => { });
        } finally {
            setIsStarting(false);
        }
    };

    // 4. Stop Session explicitly or on unmount or on timer end
    const stopSession = async () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        if (timerInterval.current) clearInterval(timerInterval.current);

        setIsActive(false);
        setTimeRemaining(null);

        try {
            const response = await fetch(`${API_BASE_URL}/stop_monitoring`, { method: 'POST' });
            const finalData = await response.json();

            if (sessionIdRef.current && finalData.status === "stopped") {
                await apiRequest("POST", `/api/study-sessions/${sessionIdRef.current}/end`, {
                    avgFocusScore: Math.round(finalData.avg_focus * 100) || 0,
                    avgStressScore: Math.round(finalData.avg_stress * 100) || 0,
                });
                toast.success("Study session saved successfully. Check your reports!");
            }
        } catch (e) {
            console.error(e);
        }

        setState({ classification: "Offline", focus: 0, stress: 0, distraction: 0 });
    };

    const startTimer = () => {
        if (timerInterval.current) clearInterval(timerInterval.current);

        timerInterval.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    // Timer finished
                    stopSession();
                    toast.success("Study session time's up!");
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handlePause = () => {
        setIsPaused(true);
        if (timerInterval.current) clearInterval(timerInterval.current);
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        // Note: Realistically, you'd want to tell the FastAPI backend to pause camera reading too, 
        // but for now stopping the polling saves resources in the frontend.
    };

    const handleResume = () => {
        setIsPaused(false);
        startTimer();
        startPolling();
    };

    // 2. Poll the API for current state
    const startPolling = () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);

        pollingInterval.current = setInterval(async () => {
            // Don't poll if paused
            if (isPaused) return;

            try {
                const response = await fetch(`${API_BASE_URL}/current_state`);
                const data = await response.json();

                if (data.status === "active") {
                    const newState = {
                        classification: data.classification,
                        focus: data.raw_scores.focus,
                        stress: data.raw_scores.stress,
                        distraction: data.raw_scores.distraction
                    };
                    setState(newState);
                    handleStressLogic(newState);

                    // Save telemetry tick to DB
                    if (sessionIdRef.current) {
                        apiRequest("POST", `/api/study-sessions/${sessionIdRef.current}/telemetry`, {
                            focusScore: Math.round(newState.focus * 100),
                            stressScore: Math.round(newState.stress * 100),
                            stateClassification: newState.classification
                        }).catch(e => console.error("Telemetry error", e));
                    }
                }
            } catch (error) {
                console.error("Polling error", error);
            }
        }, 3000);
    };

    // 3. Logic to determine if user needs a break
    const handleStressLogic = (currentState: any) => {
        if (currentState.classification === "Stressed" || currentState.stress > STRESS_THRESHOLD) {
            consecutiveStressTicks.current += 1;
        } else {
            consecutiveStressTicks.current = Math.max(0, consecutiveStressTicks.current - 1);
        }

        if (consecutiveStressTicks.current >= REQUIRED_TICKS_FOR_BREAK) {
            setShowBreakModal(true);
            consecutiveStressTicks.current = 0; // Reset
        }
    };

    // Handle cleanup on unmount only
    useEffect(() => {
        return () => {
            if (isActive) stopSession();
            if (timerInterval.current) clearInterval(timerInterval.current);
            if (pollingInterval.current) clearInterval(pollingInterval.current);
        };
    }, []); // Empty dependency array ensures this only runs on full header unmount!

    const getStateColor = (classification: string) => {
        switch (classification) {
            case "Focused": return "text-green-500";
            case "Stressed": return "text-red-500";
            case "Distracted": return "text-orange-500";
            case "Distracted (Looking Away)": return "text-orange-600";
            default: return "text-gray-500";
        }
    };

    // Only show for students
    if (user?.role !== "student") return null;

    return (
        <>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={isActive ? "default" : "outline"}
                        className={`gap-2 ${isActive ? 'bg-[#1976D2] hover:bg-[#1976D2]/90 animate-pulse-slow' : 'border-[#1976D2]/20 text-[#1976D2] hover:bg-[#1976D2]/5'}`}
                        size="sm"
                    >
                        {isActive ? (
                            <>
                                <Activity className="w-4 h-4 animate-pulse" />
                                <span className="font-mono">{timeRemaining !== null ? formatTime(timeRemaining) : "Active"}</span>
                            </>
                        ) : (
                            <>
                                <BrainCircuit className="w-4 h-4" />
                                <span className="hidden sm:inline">Smart Study</span>
                            </>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="end">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <BrainCircuit className="w-5 h-5 text-[#1976D2]" />
                            <h4 className="font-semibold text-gray-900">Smart Study Session</h4>
                        </div>

                        {isActive ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 text-sm text-center">
                                    <div className="p-2 bg-gray-50 rounded border">
                                        <p className="text-xs text-gray-500 font-semibold mb-1">State</p>
                                        <p className={`font-bold ${getStateColor(state.classification)}`}>{state.classification}</p>
                                    </div>
                                    <div className="p-2 bg-gray-50 rounded border">
                                        <p className="text-xs text-gray-500 font-semibold mb-1">Time Left</p>
                                        <p className="font-mono font-bold text-gray-900">{timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}</p>
                                    </div>
                                    <div className="p-2 bg-gray-50 rounded border">
                                        <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1"><Eye className="w-3 h-3" /> Focus</p>
                                        <p className="font-semibold text-gray-900">{Math.round(state.focus * 100)}%</p>
                                    </div>
                                    <div className="p-2 bg-gray-50 rounded border">
                                        <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1"><Activity className="w-3 h-3" /> Stress</p>
                                        <p className="font-semibold text-gray-900">{Math.round(state.stress * 100)}%</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full">
                                    {isPaused ? (
                                        <Button onClick={handleResume} className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                                            <Play className="w-4 h-4" />
                                            Resume
                                        </Button>
                                    ) : (
                                        <Button onClick={handlePause} variant="outline" className="flex-1 gap-2">
                                            <Coffee className="w-4 h-4" />
                                            Pause
                                        </Button>
                                    )}
                                    <Button onClick={stopSession} variant="destructive" className="flex-1 gap-2">
                                        <Square className="w-4 h-4" />
                                        End Early
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500">
                                    Activate AI monitoring to track your focus and get timely break suggestions.
                                </p>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Duration
                                    </label>
                                    <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select duration" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10 Minutes (Quick Review)</SelectItem>
                                            <SelectItem value="20">20 Minutes</SelectItem>
                                            <SelectItem value="30">30 Minutes (Pomodoro)</SelectItem>
                                            <SelectItem value="45">45 Minutes</SelectItem>
                                            <SelectItem value="60">60 Minutes (Deep Work)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleStart} disabled={isStarting} className="w-full gap-2 bg-[#1976D2] hover:bg-[#1976D2]/90">
                                    {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                    Start Session
                                </Button>
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>

            {/* Break Intervention Modal */}
            <Dialog open={showBreakModal} onOpenChange={setShowBreakModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Coffee className="w-5 h-5 text-orange-500" />
                            Time for a Break?
                        </DialogTitle>
                        <DialogDescription className="py-2">
                            Our AI has noticed patterns of elevated stress in your session.
                            Taking a 5-minute break to stretch, drink water, or look away from the screen can significantly improve your focus when you return.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setShowBreakModal(false)}>
                            Keep Working
                        </Button>
                        <Button onClick={() => {
                            setShowBreakModal(false);
                            stopSession();
                            toast.info("Session saved. Enjoy your break!");
                        }} className="bg-orange-500 hover:bg-orange-600">
                            Take a Break (Stop AI)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
