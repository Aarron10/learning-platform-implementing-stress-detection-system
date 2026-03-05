import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "./use-auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = "http://localhost:8000";

interface StudySessionState {
    classification: string;
    focus: number;
    stress: number;
    distraction: number;
}

interface StudySessionContextType {
    isActive: boolean;
    isStarting: boolean;
    isPaused: boolean;
    state: StudySessionState;
    selectedDuration: string;
    setSelectedDuration: (duration: string) => void;
    timeRemaining: number | null;
    showBreakModal: boolean;
    setShowBreakModal: (show: boolean) => void;
    handleStart: () => Promise<void>;
    stopSession: () => Promise<void>;
    handlePause: () => void;
    handleResume: () => void;
}

const StudySessionContext = createContext<StudySessionContextType | null>(null);

export function StudySessionProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [, setLocation] = useLocation();

    const [isActive, setIsActive] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    const [state, setState] = useState<StudySessionState>({
        classification: "Offline",
        focus: 0,
        stress: 0,
        distraction: 0
    });

    const [selectedDuration, setSelectedDuration] = useState<string>("30");
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [showBreakModal, setShowBreakModal] = useState(false);

    const pollingInterval = useRef<NodeJS.Timeout | null>(null);
    const timerInterval = useRef<NodeJS.Timeout | null>(null);
    const consecutiveStressTicks = useRef(0);
    const sessionIdRef = useRef<number | null>(null);

    const STRESS_THRESHOLD = 0.70;
    const REQUIRED_TICKS_FOR_BREAK = 20;

    const stopSession = async () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        if (timerInterval.current) clearInterval(timerInterval.current);

        setIsActive(false);
        setIsPaused(false);
        setTimeRemaining(null);

        try {
            console.log("Stopping session, sessionIdRef:", sessionIdRef.current);
            const response = await fetch(`${API_BASE_URL}/stop_monitoring`, { method: 'POST' }).catch((err) => {
                console.error("Stop monitoring fetch failed", err);
                return null;
            });

            let finalData = null;
            if (response && response.ok) {
                finalData = await response.json();
                console.log("Python stop_monitoring response:", finalData);
            } else {
                console.warn("Python stop_monitoring failed or returned error", response?.status);
            }

            if (sessionIdRef.current) {
                const finishedId = sessionIdRef.current;

                // If we got data from Python, try to save final averages to Digi-board DB
                if (finalData && finalData.status === "stopped") {
                    console.log("Saving final session stats to DB for session:", finishedId);
                    await apiRequest("POST", `/api/study-sessions/${finishedId}/end`, {
                        avgFocusScore: Math.round(finalData.avg_focus * 100) || 0,
                        avgStressScore: Math.round(finalData.avg_stress * 100) || 0,
                    }).catch(e => console.error("Telemetry end-session error", e));
                } else {
                    console.warn("Skipping DB end-session update because Python status was not 'stopped'");
                }

                // ALWAYS REDIRECT if we have an ID, even if Python API had issues
                sessionIdRef.current = null;
                toast.success("Study session finished! Loading your report...");

                console.log("Redirecting to report page:", `/reports/${finishedId}`);
                setTimeout(() => {
                    setLocation(`/reports/${finishedId}`);
                }, 1000);
            } else {
                console.error("Cannot redirect: sessionIdRef.current is null. Did the session start correctly?");
                toast.error("Session ended, but no database record was found to generate a report.");
            }
        } catch (e) {
            console.error("Error in stopSession:", e);
        }

        setState({ classification: "Offline", focus: 0, stress: 0, distraction: 0 });
    };

    const startTimer = () => {
        if (timerInterval.current) clearInterval(timerInterval.current);

        timerInterval.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    stopSession();
                    toast.success("Study session time's up!");
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleStressLogic = (currentState: StudySessionState) => {
        if (currentState.classification === "Stressed" || currentState.stress > STRESS_THRESHOLD) {
            consecutiveStressTicks.current += 1;
        } else {
            consecutiveStressTicks.current = Math.max(0, consecutiveStressTicks.current - 1);
        }

        if (consecutiveStressTicks.current >= REQUIRED_TICKS_FOR_BREAK) {
            setShowBreakModal(true);
            consecutiveStressTicks.current = 0;
        }
    };

    const startPolling = () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);

        pollingInterval.current = setInterval(async () => {
            // Check state using functional update to avoid stale closures,
            // or we use refs. Actually, `isPaused` might be stale in setInterval.
            // A better way is to use a ref for isPaused, or clear/restart polling on pause/resume.
            // Since we stop polling entirely on pause and start it on resume, no need to check isPaused.
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

                    if (sessionIdRef.current) {
                        apiRequest("POST", `/api/study-sessions/${sessionIdRef.current}/telemetry`, {
                            focusScore: Math.round(newState.focus * 100),
                            stressScore: Math.round(newState.stress * 100),
                            distractedScore: Math.round(newState.distraction * 100),
                            stateClassification: newState.classification
                        }).catch(e => console.error("Telemetry error", e));
                    }
                }
            } catch (error) {
                console.error("Polling error", error);
            }
        }, 3000);
    };

    const handleStart = async () => {
        setIsStarting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/start_monitoring`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.status === "started" || data.status === "already_running") {
                setIsActive(true);
                setTimeRemaining(parseInt(selectedDuration) * 60);
                toast.success("Study Session Started");

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
            }
        } catch (error: any) {
            console.error("Session Start Error Details:", error);
            toast.error(`Error: ${error.message || "Unknown error"}. Make sure servers are running.`);
            setIsActive(false);
            setTimeRemaining(null);
            fetch(`${API_BASE_URL}/stop_monitoring`, { method: 'POST' }).catch(() => { });
        } finally {
            setIsStarting(false);
        }
    };

    const handlePause = () => {
        setIsPaused(true);
        if (timerInterval.current) clearInterval(timerInterval.current);
        if (pollingInterval.current) clearInterval(pollingInterval.current);
    };

    const handleResume = () => {
        setIsPaused(false);
        startTimer();
        startPolling();
    };

    // Note: We don't cleanup on unmount because the Provider never unmounts while the app lives. 
    // This allows navigating between pages to keep the session alive!

    return (
        <StudySessionContext.Provider value={{
            isActive, isStarting, isPaused, state,
            selectedDuration, setSelectedDuration,
            timeRemaining, showBreakModal, setShowBreakModal,
            handleStart, stopSession, handlePause, handleResume
        }}>
            {children}
        </StudySessionContext.Provider>
    );
}

export function useStudySession() {
    const context = useContext(StudySessionContext);
    if (!context) {
        throw new Error("useStudySession must be used within a StudySessionProvider");
    }
    return context;
}
