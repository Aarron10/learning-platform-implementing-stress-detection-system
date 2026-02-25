import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, BrainCircuit, Activity, Eye, Play, Square, Coffee } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = "http://localhost:8000";

interface AIProctorProps {
    assignmentId?: number;
}

export function AIProctor({ assignmentId }: AIProctorProps) {
    const { user } = useAuth();
    const [isActive, setIsActive] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [state, setState] = useState<{
        classification: string;
        focus: number;
        stress: number;
        distraction: number;
    }>({ classification: "Offline", focus: 0, stress: 0, distraction: 0 });
    const [showBreakModal, setShowBreakModal] = useState(false);

    const pollingInterval = useRef<NodeJS.Timeout | null>(null);
    const consecutiveStressTicks = useRef(0);
    const STRESS_THRESHOLD = 0.70;
    const REQUIRED_TICKS_FOR_BREAK = 20; // 20 ticks * 3s = 60s (1 min for quicker testing)
    const sessionIdRef = useRef<number | null>(null);

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
                toast.success("AI Proctor Active");

                // Register session in our Digi-board DB
                const sessionRes = await apiRequest("POST", "/api/study-sessions/start", { assignmentId });
                const sessionData = await sessionRes.json();
                sessionIdRef.current = sessionData.id;

                startPolling();
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to connect to AI Proctor. Make sure FastAPI backend is running.");
            setIsActive(false);
        } finally {
            setIsStarting(false);
        }
    };

    // 2. Poll the API for current state
    const startPolling = () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);

        pollingInterval.current = setInterval(async () => {
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

                    // Optionally save telemetry tick to DB
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

    // 4. Stop Session explicitly or on unmount
    const stopSession = async () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        setIsActive(false);

        try {
            const response = await fetch(`${API_BASE_URL}/stop_monitoring`, { method: 'POST' });
            const finalData = await response.json();

            if (sessionIdRef.current && finalData.status === "stopped") {
                await apiRequest("POST", `/api/study-sessions/${sessionIdRef.current}/end`, {
                    avgFocusScore: Math.round(finalData.avg_focus * 100),
                    avgStressScore: Math.round(finalData.avg_stress * 100),
                });
                toast.success("Study session saved successfully.");
            }
        } catch (e) {
            console.error(e);
        }

        setState({ classification: "Offline", focus: 0, stress: 0, distraction: 0 });
    };

    useEffect(() => {
        return () => {
            if (isActive) stopSession();
        };
    }, [isActive]);

    const getStateColor = (classification: string) => {
        switch (classification) {
            case "Focused": return "text-green-500";
            case "Stressed": return "text-red-500";
            case "Distracted": return "text-orange-500";
            case "Distracted (Looking Away)": return "text-orange-600";
            default: return "text-gray-500";
        }
    };

    return (
        <div className="w-full bg-white rounded-lg border p-4 mt-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">

            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${isActive ? 'bg-primary/10 text-primary animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                    <BrainCircuit className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-semibold text-gray-900">AI Study Settings</h4>
                    <p className="text-sm text-gray-500">Monitor focus and receive break recommendations</p>
                </div>
            </div>

            {isActive ? (
                <div className="flex items-center gap-6 flex-1 justify-center">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">State</p>
                        <p className={`font-bold ${getStateColor(state.classification)}`}>{state.classification}</p>
                    </div>
                    <div className="h-8 border-r"></div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 flex items-center gap-1 justify-center"><Eye className="w-3 h-3" /> Focus</p>
                        <p className="font-semibold text-gray-900">{Math.round(state.focus * 100)}%</p>
                    </div>
                    <div className="h-8 border-r"></div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 flex items-center gap-1 justify-center"><Activity className="w-3 h-3" /> Stress</p>
                        <p className="font-semibold text-gray-900">{Math.round(state.stress * 100)}%</p>
                    </div>
                </div>
            ) : null}

            <div>
                {!isActive ? (
                    <Button onClick={handleStart} disabled={isStarting} className="gap-2">
                        {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Start Monitoring
                    </Button>
                ) : (
                    <Button onClick={stopSession} variant="destructive" className="gap-2">
                        <Square className="w-4 h-4" />
                        Stop Session
                    </Button>
                )}
            </div>

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
        </div>
    );
}
