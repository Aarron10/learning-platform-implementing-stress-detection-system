import { useQuery } from "@tanstack/react-query";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    BarElement
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Activity, Target, Trophy, AlertTriangle, Coffee, Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

const API_BASE_URL = "http://localhost:8000";

interface ReportDialogProps {
    sessionId: string | number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ sessionId, open, onOpenChange }: ReportDialogProps) {
    const { data: analytics, isLoading, error } = useQuery({
        queryKey: [`${API_BASE_URL}/api/session_analytics/${sessionId}`],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/session_analytics/${sessionId}`);
            if (!res.ok) throw new Error("Failed to fetch analytics");
            return res.json();
        },
        enabled: !!sessionId && open,
    });

    const lineData = analytics ? {
        labels: analytics.timeline.labels,
        datasets: [
            {
                label: 'Focus Score',
                data: analytics.timeline.focus_data,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                fill: true,
                tension: 0.4,
            },
            {
                label: 'Stress Score',
                data: analytics.timeline.stress_data,
                borderColor: '#F44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                fill: true,
                tension: 0.4,
            }
        ],
    } : { labels: [], datasets: [] };

    const donutData = analytics ? {
        labels: analytics.distribution.labels,
        datasets: [
            {
                data: analytics.distribution.values,
                backgroundColor: ['#4CAF50', '#F44336', '#FF9800', '#9E9E9E'],
                borderWidth: 0,
            }
        ],
    } : { labels: [], datasets: [] };

    const heatmapData = analytics ? {
        labels: analytics.timeline.labels.filter((_: any, i: number) => i % 5 === 0),
        datasets: [
            {
                label: 'Stress Intensity',
                data: analytics.timeline.stress_data.filter((_: any, i: number) => i % 5 === 0),
                backgroundColor: (context: any) => {
                    const val = context.raw;
                    if (val > 70) return '#F44336';
                    if (val > 40) return '#FF9800';
                    return '#4CAF50';
                },
                borderRadius: 4,
            }
        ],
    } : { labels: [], datasets: [] };

    const handleDownloadPDF = () => {
        window.open(`${API_BASE_URL}/api/download_report/${sessionId}`, '_blank');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-[#F8FAFC]">
                <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-white shadow-sm z-10">
                    <DialogTitle className="text-2xl font-bold flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <span className="text-3xl font-bold text-slate-900 tracking-tight">Focus Performance Report</span>
                            <span className="text-slate-500 flex items-center gap-2 mt-1text-sm font-normal">
                                Session #{sessionId} • {analytics?.metadata ? format(new Date(analytics.metadata.timestamp), "MMMM do, yyyy 'at' h:mm a") : 'Loading...'}
                            </span>
                        </div>
                        {analytics && (
                            <Button
                                onClick={handleDownloadPDF}
                                className="bg-[#1976D2] hover:bg-[#1565C0] shadow-lg shadow-blue-200 ml-auto"
                            >
                                <Download className="mr-2 h-4 w-4" /> Download PDF Report
                            </Button>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 px-4 md:px-8 py-8 border-none">
                    {isLoading ? (
                        <div className="space-y-6 max-w-7xl mx-auto">
                            <Skeleton className="h-12 w-1/4" />
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <Skeleton className="h-32" />
                                <Skeleton className="h-32" />
                                <Skeleton className="h-32" />
                                <Skeleton className="h-32" />
                            </div>
                            <Skeleton className="h-[400px]" />
                        </div>
                    ) : error || !analytics ? (
                        <div className="text-center space-y-4 py-12">
                            <h2 className="text-2xl font-bold text-red-500">Processing Report...</h2>
                            <p className="text-slate-600">The session data is still being compiled. Try reopening the report shortly.</p>
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto space-y-8">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <Card className="border-none shadow-sm bg-white">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Average Focus</p>
                                                <h3 className="text-2xl font-bold text-green-600">{Math.round(analytics.avg_focus * 100)}%</h3>
                                            </div>
                                            <div className="p-3 bg-green-50 rounded-xl">
                                                <Target className="h-6 w-6 text-green-600" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm bg-white">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Deep Work</p>
                                                <h3 className="text-2xl font-bold text-blue-600">{Math.round(analytics.deep_work_pct)}%</h3>
                                            </div>
                                            <div className="p-3 bg-blue-50 rounded-xl">
                                                <Brain className="h-6 w-6 text-blue-600" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm bg-white">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Avg Stress</p>
                                                <h3 className="text-2xl font-bold text-red-600">{Math.round(analytics.avg_stress * 100)}%</h3>
                                            </div>
                                            <div className="p-3 bg-red-50 rounded-xl">
                                                <Activity className="h-6 w-6 text-red-600" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm bg-white">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Peak Stress</p>
                                                <h3 className="text-2xl font-bold text-orange-600">{analytics.peak_stress_time}</h3>
                                            </div>
                                            <div className="p-3 bg-orange-50 rounded-xl">
                                                <AlertTriangle className="h-6 w-6 text-orange-600" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Main Chart */}
                                <div className="lg:col-span-2 space-y-8">
                                    <Card className="border-none shadow-md overflow-hidden">
                                        <CardHeader className="bg-white border-b border-slate-100">
                                            <CardTitle className="text-lg font-semibold text-slate-800">Session Timeline</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6 bg-white">
                                            <div className="h-[350px]">
                                                <Line data={lineData} options={{ maintainAspectRatio: false }} />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-none shadow-md overflow-hidden">
                                        <CardHeader className="bg-white border-b border-slate-100">
                                            <CardTitle className="text-lg font-semibold text-slate-800">Stress Intensity Heatmap</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6 bg-white">
                                            <div className="h-[200px]">
                                                <Bar data={heatmapData} options={{
                                                    maintainAspectRatio: false,
                                                    scales: { y: { display: false }, x: { grid: { display: false } } }
                                                }} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="space-y-8">
                                    {/* Donut Chart */}
                                    <Card className="border-none shadow-md overflow-hidden">
                                        <CardHeader className="bg-white border-b border-slate-100">
                                            <CardTitle className="text-lg font-semibold text-slate-800">State Distribution</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-8 bg-white flex flex-col items-center">
                                            <div className="h-[250px] w-full">
                                                <Doughnut data={donutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* AI Tutor */}
                                    <Card className="border-none shadow-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-white">
                                                <Coffee className="h-5 w-5" /> AI Study Tutor
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                                                    <p className="text-lg leading-relaxed italic">
                                                        "{analytics.ai_guidance}"
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 text-white/80 text-sm">
                                                    <Trophy className="h-4 w-4" />
                                                    <span>Based on your Focus & Stress patterns</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    )}
                </ScrollArea>
                <div className="p-4 border-t bg-gray-50 flex justify-end px-6 shrink-0">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="px-4 py-2 bg-[#2C3E50] text-white rounded-md hover:bg-[#1A252F] transition-colors"
                    >
                        Close Report
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
