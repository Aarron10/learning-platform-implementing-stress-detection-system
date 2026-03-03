import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Activity, Target, Download, ArrowLeft, Trophy, AlertTriangle, Coffee } from "lucide-react";
import { format } from "date-fns";

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

export default function ReportPage() {
    const { id } = useParams<{ id: string }>();

    const { data: analytics, isLoading, error } = useQuery({
        queryKey: [`${API_BASE_URL}/api/session_analytics/${id}`],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/session_analytics/${id}`);
            if (!res.ok) throw new Error("Failed to fetch analytics");
            return res.json();
        },
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="p-8 space-y-6 max-w-7xl mx-auto">
                <Skeleton className="h-12 w-1/4" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    if (error || !analytics) {
        return (
            <div className="p-8 text-center space-y-4">
                <h2 className="text-2xl font-bold text-red-500">Error Loading Report</h2>
                <p className="text-slate-600">We couldn't find analytics for session #{id}. It might take a few moments for data to process.</p>
                <Link href="/">
                    <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back Home</Button>
                </Link>
            </div>
        );
    }

    const lineData = {
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
    };

    const donutData = {
        labels: analytics.distribution.labels,
        datasets: [
            {
                data: analytics.distribution.values,
                backgroundColor: ['#4CAF50', '#F44336', '#FF9800'],
                borderWidth: 0,
            }
        ],
    };

    const heatmapData = {
        labels: analytics.timeline.labels.filter((_: any, i: number) => i % 5 === 0), // Thinning labels for bar chart
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
    };

    const handleDownloadPDF = () => {
        window.open(`${API_BASE_URL}/api/download_report/${id}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link href="/">
                            <Button variant="ghost" className="mb-2 -ml-2 text-slate-500 hover:text-slate-800">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Focus Performance Report</h1>
                        <p className="text-slate-500 flex items-center gap-2 mt-1">
                            Session #{id} • {format(new Date(), "MMMM do, yyyy")}
                        </p>
                    </div>
                    <Button onClick={handleDownloadPDF} className="bg-[#1976D2] hover:bg-[#1565C0] shadow-lg shadow-blue-200">
                        <Download className="mr-2 h-4 w-4" /> Download PDF Report
                    </Button>
                </div>

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
        </div>
    );
}
