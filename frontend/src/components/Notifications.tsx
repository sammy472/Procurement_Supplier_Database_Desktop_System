import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, Notification } from "../api/notifications";
import { toast } from "react-toastify";
import {
  MdNotifications,
  MdClose,
  MdDoneAll,
  MdDeleteSweep,
} from "react-icons/md";
import { formatDistanceToNow } from "date-fns";

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState<"all" | "read" | "unread">("all");
  const [selected, setSelected] = useState<Notification | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: () =>
      filter === "all" ? notificationsApi.getAll() : notificationsApi.getAll(filter),
    enabled: isOpen,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onMutate: async (id: string) => {
      queryClient.setQueryData<Notification[]>(
        ["notifications", "all"],
        (old = []) => old.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      queryClient.setQueryData<Notification[]>(
        ["notifications", filter],
        (old = []) =>
          filter === "unread"
            ? old.filter((n) => n.id !== id)
            : old.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setSelected((prev) => (prev && prev.id === id ? { ...prev, isRead: true } : prev));
      const count = queryClient.getQueryData<number>(["unread-count"]);
      if (typeof count === "number") {
        queryClient.setQueryData(["unread-count"], Math.max(0, count - 1));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", filter] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success("Notification marked as read");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const markAsUnreadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsUnread(id),
    onMutate: async (id: string) => {
      queryClient.setQueryData<Notification[]>(
        ["notifications", "all"],
        (old = []) => old.map((n) => (n.id === id ? { ...n, isRead: false } : n))
      );
      queryClient.setQueryData<Notification[]>(
        ["notifications", filter],
        (old = []) =>
          filter === "read"
            ? old.filter((n) => n.id !== id)
            : old.map((n) => (n.id === id ? { ...n, isRead: false } : n))
      );
      setSelected((prev) => (prev && prev.id === id ? { ...prev, isRead: false } : prev));
      const count = queryClient.getQueryData<number>(["unread-count"]);
      if (typeof count === "number") {
        queryClient.setQueryData(["unread-count"], count + 1);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", filter] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success("Notification marked as unread");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success("All notifications marked as read");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success("Notification deleted");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.deleteAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success("All read notifications deleted");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
  
  const filteredSorted = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = notifications;
    if (term) {
      list = list.filter((n) =>
        [n.action, n.entityType, n.description].some((v) =>
          String(v || "").toLowerCase().includes(term)
        )
      );
    }
    return list.slice().sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? db - da : da - db;
    });
  }, [notifications, search, sortOrder]);
  
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  
  const clearSelection = () => setSelectedIds([]);
  
  const batchMarkRead = async () => {
    try {
      await Promise.all(selectedIds.map((id) => notificationsApi.markAsRead(id)));
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success("Selected notifications marked as read");
    } catch (e: any) {
      toast.error(e.message || "Failed to mark selected as read");
    }
  };
  
  const batchMarkUnread = async () => {
    try {
      await Promise.all(selectedIds.map((id) => notificationsApi.markAsUnread(id)));
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success("Selected notifications marked as unread");
    } catch (e: any) {
      toast.error(e.message || "Failed to mark selected as unread");
    }
  };
  
  const batchDelete = async () => {
    if (!window.confirm("Delete selected notifications?")) return;
    try {
      await Promise.all(selectedIds.map((id) => notificationsApi.deleteNotification(id)));
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success("Selected notifications deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete selected");
    }
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: "text-green-600 dark:text-green-400",
      update: "text-blue-600 dark:text-blue-400",
      delete: "text-red-600 dark:text-red-400",
      approve: "text-green-600 dark:text-green-400",
      reject: "text-red-600 dark:text-red-400",
      upload: "text-purple-600 dark:text-purple-400",
      download: "text-indigo-600 dark:text-indigo-400",
    };
    return colors[action.toLowerCase()] || "text-gray-600 dark:text-gray-400";
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return "✨";
      case "update":
        return "✏️";
      case "delete":
        return "🗑️";
      case "approve":
        return "✅";
      case "reject":
        return "❌";
      case "upload":
        return "📤";
      case "download":
        return "📥";
      default:
        return "📋";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-[#132f4c] rounded-se-md rounded-es-md w-full max-w-5xl mx-4 h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <MdNotifications className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Notifications
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300"
            title="Close"
          >
            <MdClose className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Tabs & Actions */}
        <div className="p-4 border-b dark:border-gray-600 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === "all"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === "unread"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                Unread ({notifications.filter((n) => !n.isRead).length})
              </button>
              <button
                onClick={() => setFilter("read")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === "read"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                Read ({notifications.filter((n) => n.isRead).length})
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notifications..."
                  className="input pr-10"
                />
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Clear"
                >
                  ×
                </button>
              </div>
              <button
                onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                className="px-3 py-2 rounded-se-md rounded-es-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                title="Toggle sort"
              >
                {sortOrder === "desc" ? "Newest" : "Oldest"}
              </button>
              <button
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300"
                title="Mark all as read"
              >
                <MdDoneAll className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete all read notifications?")) {
                    deleteAllReadMutation.mutate();
                  }
                }}
                disabled={deleteAllReadMutation.isPending}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300"
                title="Delete all read"
              >
                <MdDeleteSweep className="w-5 h-5" />
              </button>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["notifications"] })}
                className="px-3 py-2 rounded-se-md rounded-es-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                title="Refresh"
              >
                Refresh
              </button>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-[#0f1929] p-2 rounded-se-md rounded-es-md">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {selectedIds.length} selected
              </p>
              <div className="flex items-center space-x-2">
                <button onClick={batchMarkRead} className="btn btn-primary text-xs px-3 py-1">
                  Mark read
                </button>
                <button onClick={batchMarkUnread} className="btn btn-secondary text-xs px-3 py-1">
                  Mark unread
                </button>
                <button onClick={batchDelete} className="btn btn-danger text-xs px-3 py-1">
                  Delete
                </button>
                <button onClick={clearSelection} className="px-3 py-1 rounded-se-md rounded-es-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-full md:w-1/2 border-r dark:border-gray-600 overflow-y-auto bg-white dark:bg-[#132f4c]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <MdNotifications className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">No notifications</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-600">
                {filteredSorted.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => {
                      if (!notification.isRead) {
                        setSelected({ ...notification, isRead: true });
                        markAsReadMutation.mutate(notification.id);
                      } else {
                        setSelected(notification);
                      }
                    }}
                    className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      !notification.isRead
                        ? "bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(notification.id)}
                          onChange={() => toggleSelected(notification.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg">{getActionIcon(notification.action)}</span>
                          <span
                            className={`text-sm font-semibold uppercase ${getActionColor(
                              notification.action
                            )}`}
                          >
                            {notification.action}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {notification.entityType}
                          </span>
                          {!notification.isRead && (
                            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                          )}
                        </div>
                        <div>
                        <p className="text-sm text-gray-900 dark:text-white mb-1 truncate">
                          {notification.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                        </div>
                        </div>
                      </div>
                        <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                          {notification.isRead ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsUnreadMutation.mutate(notification.id);
                              }}
                              className="px-2 py-1 rounded-se-md rounded-es-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs"
                            >
                              Mark unread
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsReadMutation.mutate(notification.id);
                              }}
                              className="px-2 py-1 rounded-se-md rounded-es-md bg-blue-600 text-white text-xs"
                            >
                              Mark read
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm("Delete this notification?")) {
                                deleteNotificationMutation.mutate(notification.id);
                                if (selected?.id === notification.id) setSelected(null);
                              }
                            }}
                            className="px-2 py-1 rounded-se-md rounded-es-md bg-red-600 text-white text-xs"
                          >
                            Delete
                          </button>
                        </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="hidden md:block w-1/2 overflow-y-auto bg-gray-50 dark:bg-[#0f223f]">
            {selected ? (
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{getActionIcon(selected.action)}</span>
                    <span
                      className={`text-sm font-semibold uppercase ${getActionColor(
                        selected.action
                      )}`}
                    >
                      {selected.action}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {selected.entityType}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {selected.isRead ? (
                      <button
                        onClick={() => markAsUnreadMutation.mutate(selected.id)}
                        disabled={markAsUnreadMutation.isPending}
                        className="btn btn-secondary text-xs px-3 py-1"
                      >
                        Mark unread
                      </button>
                    ) : (
                      <button
                        onClick={() => markAsReadMutation.mutate(selected.id)}
                        disabled={markAsReadMutation.isPending}
                        className="btn btn-primary text-xs px-3 py-1"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm("Delete this notification?")) {
                          deleteNotificationMutation.mutate(selected.id);
                          setSelected(null);
                        }
                      }}
                      disabled={deleteNotificationMutation.isPending}
                      className="btn btn-danger text-xs px-3 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {selected.description}
                  </p>
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <p className="text-sm">Select a notification to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
