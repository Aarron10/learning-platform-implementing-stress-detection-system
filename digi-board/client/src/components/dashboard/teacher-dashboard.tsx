import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { DashboardCard, ContentCard } from "@/components/ui/dashboard-card";
import { DataTable, StatusBadge } from "@/components/ui/data-table";
import { Assignment, Announcement, Event } from "@shared/schema";
import { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { PlusIcon, CheckIcon, AlertCircleIcon, VideoIcon } from "lucide-react";
import { DashboardCardSkeleton, AssignmentSkeleton, AnnouncementSkeleton } from "@/components/ui/content-skeletons";
import { AssignmentViewerDialog } from "@/components/ui/assignment-viewer-dialog";

export function TeacherDashboard() {
  const { user } = useAuth();
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);

  // Fetch assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  const recentAssignments = assignments
    ? [...assignments].sort((a, b) => new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime()).slice(0, 5)
    : [];

  // Fetch announcements
  const { data: announcements, isLoading: announcementsLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  // Determine due date status
  const getDueDateStatus = (dueDate: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    if (new Date(dueDate) < today) {
      return { status: "error", text: "Overdue" };
    } else if (new Date(dueDate) < tomorrow) {
      return { status: "warning", text: "Tomorrow" };
    } else if (new Date(dueDate) < nextWeek) {
      return { status: "success", text: "Next week" };
    } else {
      return { status: "info", text: format(new Date(dueDate), "MMM d") };
    }
  };

  // Assignment columns for the data table
  const assignmentColumns = [
    {
      key: "title",
      header: "Title",
      cell: (assignment: Assignment) => (
        <div>
          <div className="text-sm font-medium text-[#2C3E50]">{assignment.title}</div>
          <div className="text-xs text-[#2C3E50]/60">{assignment.description.substring(0, 30)}...</div>
        </div>
      ),
    },
    {
      key: "class",
      header: "Class",
      cell: (assignment: Assignment) => (
        <span className="text-sm text-[#2C3E50]">{assignment.classId || "General"}</span>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      cell: (assignment: Assignment) => {
        const { status, text } = getDueDateStatus(new Date(assignment.dueDate));
        return <StatusBadge status={status as any}>{text}</StatusBadge>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      cell: (assignment: Assignment) => (
        <button
          className="text-[#1976D2] hover:text-[#1976D2]/80 font-medium"
          onClick={() => setViewingAssignment(assignment)}
        >
          View
        </button>
      ),
    },
  ];

  // Quick actions for teacher
  const quickActions = [
    {
      title: "Create Assignment",
      description: "Add new assignment for your students",
      variant: "primary" as const,
      action: {
        label: "Create New",
        onClick: () => window.location.href = "/create",
      },
    },
    {
      title: "Upload Study Material",
      description: "Share documents and resources",
      variant: "secondary" as const,
      action: {
        label: "Upload Files",
        onClick: () => window.location.href = "/create",
      },
    },
    {
      title: "Post Announcement",
      description: "Share important updates with students",
      variant: "accent" as const,
      action: {
        label: "New Announcement",
        onClick: () => window.location.href = "/create",
      },
    },
  ];

  // Sample data for recent activities
  const activities = [
    {
      type: "submission",
      user: "Emma Davis",
      action: "submitted assignment",
      target: "Mathematics Quiz 3",
      time: "Today, 11:42 AM",
      icon: <CheckIcon className="h-4 w-4 text-[#1976D2]" />,
      iconBg: "bg-[#1976D2]/20",
    },
    {
      type: "question",
      user: "Michael Wilson",
      action: "asked a question on",
      target: "Term Paper Draft",
      time: "Yesterday, 4:23 PM",
      icon: <AlertCircleIcon className="h-4 w-4 text-[#FF5722]" />,
      iconBg: "bg-[#FF5722]/20",
    },
    {
      type: "view",
      user: "James Brown",
      action: "viewed study material",
      target: "Research Methods",
      time: "Yesterday, 2:15 PM",
      icon: <VideoIcon className="h-4 w-4 text-[#4CAF50]" />,
      iconBg: "bg-[#4CAF50]/20",
    },
  ];

  return (
    <div id="teacher-dashboard" className="pb-16">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#2C3E50] font-['Inter']">
          Teacher Dashboard
        </h1>
        <p className="text-[#2C3E50]/70">
          Welcome back, {user?.name}.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {assignmentsLoading || announcementsLoading ? (
          <>
            <DashboardCardSkeleton variant="primary" />
            <DashboardCardSkeleton variant="secondary" />
            <DashboardCardSkeleton variant="accent" />
          </>
        ) : (
          quickActions.map((action, i) => (
            <DashboardCard
              key={i}
              title={action.title}
              description={action.description}
              variant={action.variant}
              action={action.action}
            />
          ))
        )}
      </div>

      {/* Recent Data */}
      <div className="w-full mb-6">
        {/* Pending Assignments */}
        <div className="w-full">
          <ContentCard
            title="Recent Assignments"
            action={{
              label: "View All",
              onClick: () => window.location.href = "/assignments",
            }}
          >
            <DataTable
              data={recentAssignments}
              columns={assignmentColumns}
              emptyState={
                assignmentsLoading ? (
                  <AssignmentSkeleton />
                ) : (
                  <div className="flex flex-col items-center p-6">
                    <PlusIcon className="h-12 w-12 text-[#1976D2]/30 mb-2" />
                    <p className="text-[#2C3E50]/70">No assignments yet</p>
                    <Link href="/create">
                      <a className="mt-2 text-[#1976D2] hover:underline">Create one</a>
                    </Link>
                  </div>
                )
              }
            />
          </ContentCard>
        </div>
      </div>

      {/* Recent Activity and Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Recent Student Activity */}
        <ContentCard title="Recent Student Activity">
          <div className="space-y-4">
            {activities.map((activity, i) => (
              <div key={i} className="flex items-start">
                <div className="min-w-[40px]">
                  <div className={`w-8 h-8 rounded-full ${activity.iconBg} flex items-center justify-center`}>
                    {activity.icon}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-[#2C3E50]">
                    <span className="font-medium">{activity.user}</span> {activity.action}{" "}
                    <span className={`text-${activity.type === 'submission' ? '[#1976D2]' : activity.type === 'question' ? '[#FF5722]' : '[#4CAF50]'}`}>
                      {activity.target}
                    </span>
                  </p>
                  <p className="text-xs text-[#2C3E50]/60">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>

          <button className="mt-4 text-[#1976D2] hover:text-[#1976D2]/80 text-sm font-medium">
            View All Activity
          </button>
        </ContentCard>

        {/* Latest Announcements */}
        <ContentCard
          title="Latest Announcements"
          action={{
            label: "New",
            onClick: () => window.location.href = "/create",
          }}
        >
          {announcementsLoading ? (
            <div className="space-y-4">
              <AnnouncementSkeleton />
              <AnnouncementSkeleton />
              <AnnouncementSkeleton />
            </div>
          ) : announcements && announcements.length > 0 ? (
            <div className="space-y-4">
              {announcements.slice(0, 3).map((announcement, i) => (
                <div key={i} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex justify-between">
                    <h4 className="font-medium text-[#2C3E50]">{announcement.title}</h4>
                    <span className="text-xs text-[#2C3E50]/60">
                      {format(new Date(announcement.createdAt), "MMM d")}
                    </span>
                  </div>
                  <p className="text-sm text-[#2C3E50]/70 mt-1">
                    {announcement.content.length > 100
                      ? `${announcement.content.substring(0, 100)}...`
                      : announcement.content}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {announcement.important && (
                      <span className="text-xs bg-[#FF5722]/10 text-[#FF5722] px-2 py-1 rounded-full">
                        Important
                      </span>
                    )}
                    {announcement.category && (
                      <span className="text-xs bg-gray-100 text-[#2C3E50]/80 px-2 py-1 rounded-full">
                        {announcement.category}
                      </span>
                    )}
                    {announcement.audience && (
                      <span className="text-xs bg-[#1976D2]/10 text-[#1976D2] px-2 py-1 rounded-full">
                        {announcement.audience}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center p-6">
              <BellIcon className="h-12 w-12 text-[#1976D2]/30 mb-2" />
              <p className="text-[#2C3E50]/70">No announcements yet</p>
              <Link href="/create">
                <a className="mt-2 text-[#1976D2] hover:underline">Create one</a>
              </Link>
            </div>
          )}
        </ContentCard>
      </div>

      <AssignmentViewerDialog
        assignment={viewingAssignment}
        onClose={() => setViewingAssignment(null)}
      />
    </div>
  );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
