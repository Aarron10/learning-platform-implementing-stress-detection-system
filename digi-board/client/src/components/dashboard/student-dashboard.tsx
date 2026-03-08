import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { DashboardCard, ContentCard } from "@/components/ui/dashboard-card";
import { Assignment, Announcement, Material, Event } from "@shared/schema";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Clock,
  FileText,
  AlertCircle,
  BookOpen,
  Calendar,
  PlusIcon,
  TrendingUp,
  TrendingDown,
  BrainCircuit,
  BatteryCharging
} from "lucide-react";

export function StudentDashboard() {
  const { user } = useAuth();

  // Fetch assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  // Fetch announcements
  const { data: announcements, isLoading: announcementsLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  // Fetch materials
  const { data: materials, isLoading: materialsLoading } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
  });

  // Fetch adaptive workload recommendations
  const { data: workloadData, isLoading: workloadLoading } = useQuery<{
    mode: string;
    capacity: number;
    trend: string;
    recentSessionsCount: number;
    avgStress: number;
    recommendedTasks: Assignment[];
  }>({
    queryKey: ["/api/recommended-workload"],
  });

  const upcomingAssignments = workloadData?.recommendedTasks || [];

  // Get important announcements
  const importantAnnouncements = announcements
    ? announcements
      .filter((announcement) => announcement.important)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
    : [];


  // Quick access cards
  const quickAccessCards = [
    {
      title: "Assignments",
      icon: <FileText className="h-8 w-8 text-[#1976D2] mb-2" />,
      count: assignments?.length || 0,
      link: "/assignments",
      color: "bg-[#1976D2]/10",
      textColor: "text-[#1976D2]",
    },
    {
      title: "Materials",
      icon: <BookOpen className="h-8 w-8 text-[#4CAF50] mb-2" />,
      count: materials?.length || 0,
      link: "/materials",
      color: "bg-[#4CAF50]/10",
      textColor: "text-[#4CAF50]",
    },
  ];

  return (
    <div id="student-dashboard" className="pb-16">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#2C3E50] font-['Inter']">
          Student Dashboard
        </h1>
        <p className="text-[#2C3E50]/70">
          Welcome back, {user?.name}. You have{" "}
          <span className="text-[#FF5722] font-medium">
            {upcomingAssignments.length} upcoming
          </span>{" "}
          assignments.
        </p>
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {quickAccessCards.map((card, i) => (
          <Link key={i} href={card.link}>
            <a className="block">
              <div className={`card p-6 ${card.color} rounded-md shadow-sm transition-all hover:translate-y-[-2px] hover:shadow-md`}>
                <div className="flex flex-col items-center text-center">
                  {card.icon}
                  <h3 className={`font-medium ${card.textColor} mb-1 font-['Inter']`}>
                    {card.title}
                  </h3>
                  <p className="text-2xl font-bold mt-2">{card.count}</p>
                </div>
              </div>
            </a>
          </Link>
        ))}
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adaptive Workload Assignments */}
        <ContentCard
          title="Adaptive Workload"
          action={{
            label: "All Assignments",
            onClick: () => window.location.href = "/assignments",
          }}
        >
          {workloadLoading ? (
            <div className="flex justify-center p-4">Analyzing workload...</div>
          ) : (
            <div className="space-y-4">
              {/* Capacity Status Bar */}
              {workloadData && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-2">
                      <BrainCircuit className="h-5 w-5 text-[#673AB7]" />
                      <span className="font-semibold text-[#2C3E50] text-sm">{workloadData.mode}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-xs font-medium">
                      {workloadData.trend === "Trending Up" ? (
                        <span className="text-red-500 flex items-center"><TrendingUp className="h-3 w-3 mr-1" /> Stress Trend</span>
                      ) : workloadData.trend === "Trending Down" ? (
                        <span className="text-green-500 flex items-center"><TrendingDown className="h-3 w-3 mr-1" /> Stress Trend</span>
                      ) : (
                        <span className="text-gray-500">Stable</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <BatteryCharging className={`h-6 w-6 ${workloadData.capacity < 30 ? 'text-red-500' : workloadData.capacity > 70 ? 'text-green-500' : 'text-yellow-500'}`} />
                    <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${workloadData.capacity < 30 ? 'bg-red-500' : workloadData.capacity > 70 ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${workloadData.capacity}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold w-10 text-right">{workloadData.capacity}%</span>
                  </div>
                </div>
              )}

              {upcomingAssignments.length === 0 ? (
                <div className="flex flex-col items-center p-6">
                  <FileText className="h-12 w-12 text-[#1976D2]/30 mb-2" />
                  <p className="text-[#2C3E50]/70">No tasks currently assigned</p>
                </div>
              ) : (
                upcomingAssignments.map((assignment, i) => (
                  <div key={i} className={`flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0 ${workloadData?.mode === 'Immediate Recovery Mode' && assignment.weightage === 1 ? 'bg-green-50/50 p-2 rounded-md' : ''}`}>
                    <div className="bg-[#1976D2]/10 rounded-md p-2 text-center min-w-[60px]">
                      <Clock className="h-5 w-5 text-[#1976D2] mx-auto" />
                      <span className="block text-sm text-[#1976D2] font-medium mt-1">
                        {format(new Date(assignment.dueDate), "MMM d")}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-[#2C3E50]">{assignment.title}</h4>
                      <p className="text-sm text-[#2C3E50]/70">
                        {assignment.description.length > 60
                          ? `${assignment.description.substring(0, 60)}...`
                          : assignment.description}
                      </p>
                      <div className="mt-2 flex space-x-2 flex-wrap gap-y-2">
                        {assignment.classId && (
                          <span className="text-xs bg-gray-100 text-[#2C3E50]/80 px-2 py-1 rounded-full">
                            {assignment.classId}
                          </span>
                        )}
                        <span className="text-xs bg-[#1976D2]/10 text-[#1976D2] px-2 py-1 rounded-full">
                          Due {format(new Date(assignment.dueDate), "MMM d, h:mm a")}
                        </span>
                        {workloadData?.mode === "Immediate Recovery Mode" && assignment.weightage === 1 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                            Recommended (Low Effort)
                          </span>
                        )}
                        {workloadData?.mode === "Peak Performance" && (assignment.weightage === 3 || assignment.priority === 'high') && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">
                            High Value Task
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </ContentCard>

        {/* Important Announcements */}
        <ContentCard
          title="Important Announcements"
          action={{
            label: "All Announcements",
            onClick: () => window.location.href = "/announcements",
          }}
        >
          {announcementsLoading ? (
            <div className="flex justify-center p-4">Loading announcements...</div>
          ) : importantAnnouncements.length === 0 ? (
            <div className="flex flex-col items-center p-6">
              <AlertCircle className="h-12 w-12 text-[#FF5722]/30 mb-2" />
              <p className="text-[#2C3E50]/70">No important announcements</p>
            </div>
          ) : (
            <div className="space-y-4">
              {importantAnnouncements.map((announcement, i) => (
                <div key={i} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex justify-between">
                    <h4 className="font-medium text-[#2C3E50]">{announcement.title}</h4>
                    <span className="text-xs text-[#2C3E50]/60">
                      {format(new Date(announcement.createdAt), "MMM d")}
                    </span>
                  </div>
                  <p className="text-sm text-[#2C3E50]/70 mt-1">
                    {announcement.content.length > 120
                      ? `${announcement.content.substring(0, 120)}...`
                      : announcement.content}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs bg-[#FF5722]/10 text-[#FF5722] px-2 py-1 rounded-full">
                      Important
                    </span>
                    {announcement.category && (
                      <span className="text-xs bg-gray-100 text-[#2C3E50]/80 px-2 py-1 rounded-full">
                        {announcement.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ContentCard>
      </div>

      {/* More Sections */}
      <div className="w-full mt-6">
        {/* Recent Materials */}
        <div className="w-full">
          <ContentCard
            title="Recent Study Materials"
            action={{
              label: "Browse All",
              onClick: () => window.location.href = "/materials",
            }}
          >
            {materialsLoading ? (
              <div className="flex justify-center p-4">Loading materials...</div>
            ) : !materials || materials.length === 0 ? (
              <div className="flex flex-col items-center p-6">
                <BookOpen className="h-12 w-12 text-[#1976D2]/30 mb-2" />
                <p className="text-[#2C3E50]/70">No study materials available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {materials.slice(0, 4).map((material, i) => (
                  <div key={i} className="card bg-white border border-gray-100 rounded-md p-4 hover:shadow-md transition-shadow">
                    <h4 className="font-medium text-[#2C3E50] truncate">{material.title}</h4>
                    <p className="text-sm text-[#2C3E50]/70 h-10 overflow-hidden">
                      {material.description.substring(0, 60)}...
                    </p>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs text-[#2C3E50]/60">
                        {format(new Date(material.uploadedAt), "MMM d, yyyy")}
                      </span>
                      <button className="text-[#1976D2] hover:text-[#1976D2]/80 text-sm font-medium">
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ContentCard>
        </div>
      </div>
    </div>
  );
}
