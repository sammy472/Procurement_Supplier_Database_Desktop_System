import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tendersApi, CreateTenderInput, Tender, TenderTask } from "../api/tenders";
import { apiClient } from "../api/client";
import { authApi } from "../api/auth";
import { toast } from "react-toastify";
import { MdAdd, MdDelete, MdUpload, MdDownload, MdPictureAsPdf, MdVisibility } from "react-icons/md";
import { useAuthStore } from "../store/authStore";
import DocumentViewer from "../components/DocumentViewer";

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function Tenders() {
  const queryClient = useQueryClient();
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    deadline: "",
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    deadline: "",
  });
  const [editTasks, setEditTasks] = useState<
    { id?: string; title: string; description: string; assigneeId: string; dueDate: string }[]
  >([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TenderTask | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assigneeId: "",
    dueDate: "",
  });
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [tasks, setTasks] = useState<
    { title: string; description: string; assigneeId: string; dueDate: string }[]
  >([]);
  // const hasRole = useAuthStore((s) => s.hasRole);
  const user = useAuthStore((s) => s.user);

  const { data: tenders = [], isLoading } = useQuery({
    queryKey: ["tenders"],
    queryFn: async () => {
      return await tendersApi.getTenders();
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-for-tenders"],
    queryFn: async () => {
      const items = await authApi.getUsers();
      return items
        .filter((u) => u.isActive)
        .map<UserOption>((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          role: u.role,
        }));
    },
  });

  const createTenderMutation = useMutation({
    mutationFn: async (data: CreateTenderInput) => {
      return await tendersApi.createTender(data);
    },
    onSuccess: (tender) => {
      queryClient.setQueryData<Tender[]>(
        ["tenders"],
        (old: Tender[] | undefined) => [tender, ...((old as Tender[]) || [])]
      );
      toast.success("Tender created");
      setForm({ title: "", description: "", deadline: "" });
      setTasks([]);
      queryClient.invalidateQueries({ queryKey: ["tenders"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create tender");
    },
  });

  const deleteTenderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await tendersApi.deleteTender(id);
    },
    onSuccess: (_: void, id: string) => {
      queryClient.setQueryData<Tender[]>(
        ["tenders"],
        (old: Tender[] | undefined) => ((old as Tender[]) || []).filter((t) => t.id !== id)
      );
      toast.success("Tender deleted");
      setSelectedTender(null);
      queryClient.invalidateQueries({ queryKey: ["tenders"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete tender");
    },
  });

  const updateTenderMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      title: string;
      description?: string;
      deadline: string;
    }) => {
      return await tendersApi.updateTender(params.id, {
        title: params.title,
        description: params.description,
        deadline: params.deadline,
      });
    },
    onSuccess: (tender) => {
      queryClient.setQueryData<Tender[]>(
        ["tenders"],
        (old: Tender[] | undefined) =>
          ((old as Tender[]) || []).map((t) => (t.id === tender.id ? { ...t, ...tender } : t))
      );
      toast.success("Tender updated");
      queryClient.invalidateQueries({ queryKey: ["tenders"] });
      if (selectedTender && tender.id === selectedTender.id) {
        setSelectedTender(tender);
        queryClient.invalidateQueries({ queryKey: ["tender", tender.id] });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update tender");
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (params: { taskId: string; file: File }) => {
      return await tendersApi.uploadTaskFile(
        params.taskId,
        params.file,
        (percent) => {
          setUploadProgress((prev) => ({ ...prev, [params.taskId]: percent }));
        }
      );
    },
    onSuccess: (res) => {
      toast.success("Task file uploaded");
      if (selectedTender) {
        queryClient.setQueryData<{ tender: Tender; tasks: TenderTask[] }>(
          ["tender", selectedTender.id],
          (old: { tender: Tender; tasks: TenderTask[] } | undefined) =>
            old
              ? {
                  ...old,
                  tasks: (old.tasks || []).map((t) =>
                    t.id === res.task.id ? { ...t, ...res.task } : t
                  ),
                }
              : old
        );
      }
      setUploadProgress((prev) => prev);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload file");
      setUploadProgress((prev) => prev);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (params: {
      taskId: string;
      title?: string;
      description?: string;
      assigneeId?: string;
      dueDate?: string;
      status?: string;
    }) => {
      return await tendersApi.updateTask(params.taskId, {
        title: params.title,
        description: params.description,
        assigneeId: params.assigneeId,
        dueDate: params.dueDate,
        status: params.status,
      });
    },
    onSuccess: (task) => {
      toast.success("Task updated");
      if (selectedTender) {
        queryClient.setQueryData<{ tender: Tender; tasks: TenderTask[] }>(
          ["tender", selectedTender.id],
          (old: { tender: Tender; tasks: TenderTask[] } | undefined) =>
            old
              ? {
                  ...old,
                  tasks: (old.tasks || []).map((t) =>
                    t.id === task.id ? { ...t, ...task } : t
                  ),
                }
              : old
        );
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update task");
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (params: {
      tenderId: string;
      title: string;
      description?: string;
      assigneeId: string;
      dueDate?: string;
    }) => {
      return await tendersApi.createTask(params.tenderId, {
        title: params.title,
        description: params.description,
        assigneeId: params.assigneeId,
        dueDate: params.dueDate,
      });
    },
    onSuccess: (task) => {
      toast.success("Task created");
      if (selectedTender) {
        queryClient.setQueryData<{ tender: Tender; tasks: TenderTask[] }>(
          ["tender", selectedTender.id],
          (old: { tender: Tender; tasks: TenderTask[] } | undefined) =>
            old
              ? {
                  ...old,
                  tasks: [task, ...(old.tasks || [])],
                }
              : old
        );
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create task");
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await tendersApi.deleteTask(taskId);
    },
    onSuccess: (_: void, taskId: string) => {
      toast.success("Task deleted");
      if (selectedTender) {
        queryClient.setQueryData<{ tender: Tender; tasks: TenderTask[] }>(
          ["tender", selectedTender.id],
          (old: { tender: Tender; tasks: TenderTask[] } | undefined) =>
            old
              ? {
                  ...old,
                  tasks: (old.tasks || []).filter((t) => t.id !== taskId),
                }
              : old
        );
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete task");
    },
  });

  const deleteTaskFileMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await tendersApi.deleteTaskFile(taskId);
    },
    onSuccess: (task) => {
      toast.success("Task file deleted");
      if (selectedTender) {
        queryClient.setQueryData<{ tender: Tender; tasks: TenderTask[] }>(
          ["tender", selectedTender.id],
          (old: { tender: Tender; tasks: TenderTask[] } | undefined) =>
            old
              ? {
                  ...old,
                  tasks: (old.tasks || []).map((t) =>
                    t.id === task.id ? { ...t, ...task } : t
                  ),
                }
              : old
        );
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete task file");
    },
  });

  const { data: tenderDetails, isLoading: isTenderDetailsLoading } = useQuery({
    queryKey: ["tender", selectedTender?.id],
    enabled: !!selectedTender,
    queryFn: async () => {
      if (!selectedTender) throw new Error("No tender selected");
      return await tendersApi.getTender(selectedTender.id);
    },
  });
  const { data: mergedDoc, refetch: refetchMergedDoc } = useQuery({
    queryKey: ["tender-merged", selectedTender?.id],
    enabled: !!selectedTender,
    queryFn: async () => {
      if (!selectedTender) throw new Error("No tender selected");
      return await tendersApi.getMergedDocumentUrl(selectedTender.id);
    },
  });
  const [isMergedViewerOpen, setIsMergedViewerOpen] = useState(false);
  const [isTaskViewerOpen, setIsTaskViewerOpen] = useState(false);
  const [taskViewerUrl, setTaskViewerUrl] = useState("");
  const [taskViewerName, setTaskViewerName] = useState("");
  const mergeDocumentsMutation = useMutation({
    mutationFn: async (tenderId: string) => {
      return await tendersApi.mergeDocuments(tenderId);
    },
    onSuccess: () => {
      toast.success("Merged document created");
      refetchMergedDoc();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to merge documents");
    },
  });
  const deleteMergedMutation = useMutation({
    mutationFn: async (tenderId: string) => {
      return await tendersApi.deleteMergedDocument(tenderId);
    },
    onSuccess: () => {
      toast.success("Merged document deleted");
      refetchMergedDoc();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete merged document");
    },
  });
  const handleDownloadMerged = async () => {
    if (!selectedTender) return;
    try {
      const blob = await tendersApi.downloadMergedDocument(selectedTender.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `tender-${selectedTender.title}-merged.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || "Failed to download merged document");
    }
  };

  const handleAddTask = () => {
    setTasks([
      ...tasks,
      { title: "", description: "", assigneeId: "", dueDate: "" },
    ]);
  };

  const handleTaskChange = (
    index: number,
    field: "title" | "description" | "assigneeId" | "dueDate",
    value: string
  ) => {
    const next = [...tasks];
    next[index] = { ...next[index], [field]: value };
    setTasks(next);
  };

  const handleRemoveTask = (index: number) => {
    const next = [...tasks];
    next.splice(index, 1);
    setTasks(next);
  };

  const handleCreateTender = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.deadline) {
      toast.error("Title and deadline are required");
      return;
    }

    const payload: CreateTenderInput = {
      title: form.title,
      description: form.description || undefined,
      deadline: form.deadline,
      tasks: tasks
        .filter((t) => t.title && t.assigneeId)
        .map((t) => ({
          title: t.title,
          description: t.description || undefined,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate || undefined,
        })),
    };

    createTenderMutation.mutate(payload);
  };

  const handleUploadFile = (taskId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setUploadProgress((prev) => ({ ...prev, [taskId]: 0 }));
    uploadFileMutation.mutate({ taskId, file });
  };

  const handleViewFile = async (taskId: string) => {
    try {
      const result = await tendersApi.getTaskFileUrl(taskId);
      if (result.url) {
        setTaskViewerUrl(result.url);
        setTaskViewerName(result.fileName || "Document");
        setIsTaskViewerOpen(true);
      } else {
        toast.error("No file URL available for this task");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to open file");
    }
  };

  const handleDownloadTenderPdf = async () => {
    if (!selectedTender) return;
    try {
      const response = await apiClient.get(
        `/tenders/${selectedTender.id}/pdf`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `tender-${selectedTender.title}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || "Failed to download summary PDF");
    }
  };

  const getProgress = () => {
    const tasks = tenderDetails?.tasks || [];
    if (tasks.length === 0) return { submitted: 0, total: 0, percent: 0 };
    const submitted = tasks.filter((t) => t.status === "submitted").length;
    const percent = Math.round((submitted / tasks.length) * 100);
    return { submitted, total: tasks.length, percent };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block">
            <div className="w-12 h-12 border-4 border-gray-300 dark:border-[#3f51b5] border-t-primary-500 rounded-se-md rounded-es-md animate-spin"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading tenders...
          </p>
        </div>
      </div>
    );
  }

  const progress = getProgress();

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="page-title">Tenders</h1>
        <p className="page-subtitle">
          Create tenders, assign tasks, and track submission progress.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateTender(e);
            }}
            className="card space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                New Tender
              </h2>
              <button
                type="submit"
                disabled={createTenderMutation.isPending}
                className="btn btn-primary text-sm"
              >
                <MdAdd className="w-4 h-4 mr-1" />
                Create
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Title
              </label>
              <input
                type="text"
                className="input"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                className="input min-h-[80px]"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Deadline
              </label>
              <input
                type="datetime-local"
                className="input"
                value={form.deadline}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, deadline: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tasks
                </span>
                <button
                  type="button"
                  onClick={handleAddTask}
                  className="btn btn-secondary text-xs"
                >
                  <MdAdd className="w-4 h-4 mr-1" />
                  Add Task
                </button>
              </div>

              {tasks.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No tasks added yet. You can still add tasks later.
                </p>
              )}

                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {tasks.map((task, index) => (
                  <div
                    key={index}
                        className="rounded-lg p-3 space-y-2 shadow-sm dark:shadow-md bg-white dark:bg-[#132f4c]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Task {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(index)}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Title"
                      className="input text-xs"
                      value={task.title}
                      onChange={(e) =>
                        handleTaskChange(index, "title", e.target.value)
                      }
                    />
                    <textarea
                      placeholder="Description"
                      className="input text-xs min-h-[60px]"
                      value={task.description}
                      onChange={(e) =>
                        handleTaskChange(index, "description", e.target.value)
                      }
                    />
                    <select
                      className="input text-xs"
                      value={task.assigneeId}
                      onChange={(e) =>
                        handleTaskChange(index, "assigneeId", e.target.value)
                      }
                    >
                      <option value="">Select member</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role})
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className="input text-xs"
                      value={task.dueDate}
                      onChange={(e) =>
                        handleTaskChange(index, "dueDate", e.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Existing Tenders
              </h2>
            </div>

            {tenders.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No tenders yet. Create one on the left to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-[#3f51b5] text-sm">
                  <thead className="bg-gray-50 dark:bg-[#132f4c]">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                        Title
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                        Deadline
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1f2937]">
                    {tenders.map((tender) => (
                      <tr
                        key={tender.id}
                        className={
                          selectedTender?.id === tender.id
                            ? "bg-primary-50/60 dark:bg-[#132f4c]"
                            : ""
                        }
                      >
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
                            onClick={() => setSelectedTender(tender)}
                          >
                            {tender.title}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {[tender.creatorFirstName, tender.creatorLastName].filter(Boolean).join(" ") || "N/A"}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {new Date(tender.deadline).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-[#1f2937] text-gray-700 dark:text-gray-200">
                            {tender.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setSelectedTender(tender)}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            View
                          </button>
                          {user?.id === tender.createdBy && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTender(tender);
                                  setEditForm({
                                    title: tender.title,
                                    description: tender.description || "",
                                    deadline: new Date(tender.deadline).toISOString().slice(0, 16),
                                  });
                                  const existingTasks =
                                    (tenderDetails?.tasks || []).map((t) => ({
                                      id: t.id,
                                      title: t.title || "",
                                      description: t.description || "",
                                      assigneeId: t.assigneeId || "",
                                      dueDate: t.dueDate
                                        ? new Date(t.dueDate).toISOString().slice(0, 10)
                                        : "",
                                    })) || [];
                                  setEditTasks(existingTasks);
                                  setIsEditModalOpen(true);
                                }}
                                className="text-xs text-gray-600 dark:text-gray-300 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTenderMutation.mutate(tender.id)}
                                className="inline-flex items-center text-xs text-red-500 hover:text-red-600"
                              >
                                <MdDelete className="w-4 h-4 mr-1" />
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        {isEditModalOpen && selectedTender && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#132f4c] rounded-md max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 flex justify-between items-center p-6 border-b dark:border-[#3f51b5] bg-white dark:bg-[#132f4c]">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Tender</h2>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  Close
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateTenderMutation.mutate({
                    id: selectedTender.id,
                    title: editForm.title,
                    description: editForm.description || undefined,
                    deadline: editForm.deadline,
                  });
                  setIsEditModalOpen(false);
                }}
                className="p-6 space-y-4"
              >
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Title
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description
                  </label>
                  <textarea
                    className="input min-h-[80px]"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Deadline
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={editForm.deadline}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, deadline: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>

                <div className="pt-6 mt-6 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-white">
                      Tasks
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setEditTasks((prev) => [
                          ...prev,
                          { title: "", description: "", assigneeId: "", dueDate: "" },
                        ])
                      }
                      className="btn btn-secondary text-xs"
                    >
                      Add Task
                    </button>
                  </div>

                  {editTasks.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No tasks to edit
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {editTasks.map((t, idx) => (
                        <div
                          key={t.id || `new-${idx}`}
                          className="border border-gray-200 dark:border-[#3f51b5] rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                              {t.id ? `Task` : `New Task`}
                            </span>
                            <div className="space-x-2">
                              {t.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateTaskMutation.mutate({
                                        taskId: t.id!,
                                        title: t.title,
                                        description: t.description || undefined,
                                        assigneeId: t.assigneeId || undefined,
                                        dueDate: t.dueDate || undefined,
                                      })
                                    }
                                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm("Delete this task permanently?")
                                      ) {
                                        deleteTaskMutation.mutate(t.id!);
                                        setEditTasks((prev) =>
                                          prev.filter((et) => et.id !== t.id)
                                        );
                                      }
                                    }}
                                    className="text-xs text-red-500 hover:text-red-600"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!t.title || !t.assigneeId) {
                                        toast.error("Title and assignee are required");
                                        return;
                                      }
                                      createTaskMutation.mutate({
                                        tenderId: selectedTender.id,
                                        title: t.title,
                                        description: t.description || undefined,
                                        assigneeId: t.assigneeId,
                                        dueDate: t.dueDate || undefined,
                                      });
                                    }}
                                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditTasks((prev) =>
                                        prev.filter((_, i) => i !== idx)
                                      )
                                    }
                                    className="text-xs text-gray-600 dark:text-gray-300 hover:underline"
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Title"
                            className="input text-xs"
                            value={t.title}
                            onChange={(e) =>
                              setEditTasks((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], title: e.target.value };
                                return next;
                              })
                            }
                          />
                          <textarea
                            placeholder="Description"
                            className="input text-xs min-h-[60px]"
                            value={t.description}
                            onChange={(e) =>
                              setEditTasks((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], description: e.target.value };
                                return next;
                              })
                            }
                          />
                          <select
                            className="input text-xs"
                            value={t.assigneeId}
                            onChange={(e) =>
                              setEditTasks((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], assigneeId: e.target.value };
                                return next;
                              })
                            }
                          >
                            <option value="">Select member</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.role})
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            className="input text-xs"
                            value={t.dueDate}
                            onChange={(e) =>
                              setEditTasks((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], dueDate: e.target.value };
                                return next;
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

          {selectedTender && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedTender.title}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Deadline:{" "}
                    {new Date(selectedTender.deadline).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Progress
                  </p>
                  <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {progress.submitted}/{progress.total} submitted (
                    {progress.percent}%)
                  </p>
                  <div className="mt-1 h-2 w-40 bg-gray-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTenderPdf}
                    className="mt-2 inline-flex items-center text-xs text-primary-600 dark:text-primary-300 hover:underline"
                  >
                    Download summary PDF
                  </button>
                  {user && selectedTender && user.id === selectedTender.createdBy && (
                    <div className="mt-2">
                      <button
                        type="button"
                        disabled={mergeDocumentsMutation.isPending}
                        onClick={() => mergeDocumentsMutation.mutate(selectedTender.id)}
                        className="inline-flex items-center text-xs text-primary-600 dark:text-primary-300 hover:underline"
                      >
                        <MdPictureAsPdf className="w-4 h-4 mr-1" />
                        Merge task documents
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isTenderDetailsLoading && !tenderDetails && (
                <div className="py-4 text-sm text-gray-500 dark:text-gray-400">
                  Loading tasks...
                </div>
              )}

              {!isTenderDetailsLoading && tenderDetails && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-[#3f51b5] text-xs">
                    <thead className="bg-gray-50 dark:bg-[#132f4c]">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Task
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Assignee
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Due Date
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          File
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                          Upload
                        </th>
                          {user && selectedTender && user.id === selectedTender.createdBy && (
                          <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#1f2937]">
                      {tenderDetails.tasks.map((task) => (
                        <tr key={task.id}>
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                            <div className="font-medium">{task.title}</div>
                            {task.description && (
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {task.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                            {task.assigneeFirstName
                              ? `${task.assigneeFirstName} ${
                                  task.assigneeLastName || ""
                                }`
                              : "Unassigned"}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={
                                task.status === "submitted"
                                  ? "inline-flex px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                  : task.status === "deleted"
                                  ? "inline-flex px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                                  : "inline-flex px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300"
                              }
                            >
                              {task.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                            {task.fileName ? (
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => handleViewFile(task.id)}
                                  className="text-primary-600 dark:text-primary-400 hover:underline"
                                >
                                  {task.fileName}
                                </button>
                                {user &&
                                  (user.id === task.assigneeId ||
                                    (selectedTender && user.id === selectedTender.createdBy)) && (
                                    <button
                                      type="button"
                                      onClick={() => deleteTaskFileMutation.mutate(task.id)}
                                      className="text-[11px] text-red-500 hover:text-red-600"
                                    >
                                      Delete file
                                    </button>
                                  )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {task.status === "deleted" ? (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Deleted
                              </span>
                            ) : user &&
                              (user.id === task.assigneeId ||
                                (selectedTender && user.id === selectedTender.createdBy)) ? (
                              <div className="flex flex-col items-end space-y-1">
                                <label className="inline-flex items-center px-3 py-1 rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300 text-xs cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-500/20">
                                  <MdUpload className="w-4 h-4 mr-1" />
                                  {uploadProgress[task.id] && uploadProgress[task.id] > 0
                                    ? `Uploading ${uploadProgress[task.id]}%`
                                    : "Upload"}
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) =>
                                      handleUploadFile(task.id, e.target.files)
                                    }
                                  />
                                </label>
                                {uploadProgress[task.id] !== undefined &&
                                  uploadProgress[task.id] > 0 &&
                                  uploadProgress[task.id] < 100 && (
                            <div className="w-28 h-1.5 bg-gray-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-primary-500"
                                        style={{
                                          width: `${uploadProgress[task.id]}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">-</span>
                            )}
                          </td>
                          {user && selectedTender && user.id === selectedTender.createdBy && (
                          <td className="px-4 py-2 text-right space-x-2">
                              {task.fileName && (
                                <button
                                  type="button"
                                  onClick={() => handleViewFile(task.id)}
                                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                  title="View"
                                >
                                  <MdVisibility className="inline w-4 h-4 mr-1" />
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTask(task);
                                  setTaskForm({
                                    title: task.title || "",
                                    description: task.description || "",
                                    assigneeId: task.assigneeId || "",
                                    dueDate: task.dueDate
                                      ? new Date(task.dueDate).toISOString().slice(0, 10)
                                      : "",
                                  });
                                  setIsTaskModalOpen(true);
                                }}
                                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                              >
                                Edit
                              </button>
                              {user && selectedTender && user.id === selectedTender.createdBy && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm("Delete this task permanently?")) {
                                      deleteTaskMutation.mutate(task.id);
                                    }
                                  }}
                                  className="text-xs text-red-500 hover:text-red-600"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedTender && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
                  Merged Document
                </h3>
                <div className="space-x-2">
                  {mergedDoc?.url ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsMergedViewerOpen(true)}
                        className="inline-flex items-center text-xs text-primary-600 dark:text-primary-300 hover:underline"
                      >
                        <MdPictureAsPdf className="w-4 h-4 mr-1" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadMerged}
                        className="inline-flex items-center text-xs text-primary-600 dark:text-primary-300 hover:underline"
                      >
                        <MdDownload className="w-4 h-4 mr-1" />
                        Download
                      </button>
                      {user && user.id === selectedTender.createdBy && (
                        <button
                          type="button"
                          onClick={() => deleteMergedMutation.mutate(selectedTender.id)}
                          className="inline-flex items-center text-xs text-red-500 hover:text-red-600"
                        >
                          <MdDelete className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      No merged document yet
                    </span>
                  )}
                </div>
              </div>
              {mergedDoc?.url && (
                <DocumentViewer
                  documentUrl={mergedDoc.url}
                  documentName={`tender-${selectedTender.title}-merged.pdf`}
                  isOpen={isMergedViewerOpen}
                  onClose={() => setIsMergedViewerOpen(false)}
                  onDownload={handleDownloadMerged}
                />
              )}
            </div>
          )}
          {isTaskViewerOpen && taskViewerUrl && (
            <DocumentViewer
              documentUrl={taskViewerUrl}
              documentName={taskViewerName}
              isOpen={isTaskViewerOpen}
              onClose={() => setIsTaskViewerOpen(false)}
            />
          )}
          {isTaskModalOpen && editingTask && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-[#132f4c] rounded-md max-w-xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 flex justify-between items-center p-6 border-b dark:border-[#3f51b5] bg-white dark:bg-[#132f4c]">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Task</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTaskModalOpen(false);
                      setEditingTask(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  >
                    Close
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateTaskMutation.mutate({
                      taskId: editingTask.id,
                      title: taskForm.title,
                      description: taskForm.description || undefined,
                      assigneeId: taskForm.assigneeId || undefined,
                      dueDate: taskForm.dueDate || undefined,
                    });
                  }}
                  className="p-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Title
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={taskForm.title}
                      onChange={(e) =>
                        setTaskForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      className="input min-h-[80px]"
                      value={taskForm.description}
                      onChange={(e) =>
                        setTaskForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Assignee
                    </label>
                    <select
                      className="input"
                      value={taskForm.assigneeId}
                      onChange={(e) =>
                        setTaskForm((prev) => ({ ...prev, assigneeId: e.target.value }))
                      }
                    >
                      <option value="">Select member</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Due Date
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={taskForm.dueDate}
                      onChange={(e) =>
                        setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))
                      }
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTaskModalOpen(false);
                        setEditingTask(null);
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

