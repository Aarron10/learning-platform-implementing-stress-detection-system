import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BrainCircuit, Activity, Eye, Play, Square, Coffee, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useStudySession } from "@/hooks/use-study-session";

export function GlobalStudySession() {
    const { user } = useAuth();

    // Global State
    const {
        isActive, isStarting, isPaused, state,
        selectedDuration, setSelectedDuration,
        timeRemaining, showBreakModal, setShowBreakModal,
        handleStart, stopSession, handlePause, handleResume
    } = useStudySession();

    // Local UI State
    const [popoverOpen, setPopoverOpen] = useState(false);

    // Format seconds into MM:SS
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

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
                            // toast.info("Session saved. Enjoy your break!"); // Removed to avoid duplicate toasts from context
                        }} className="bg-orange-500 hover:bg-orange-600">
                            Take a Break (Stop AI)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
