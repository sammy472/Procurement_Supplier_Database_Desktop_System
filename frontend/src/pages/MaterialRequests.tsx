import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  materialRequestsApi,
  MaterialRequest,
  MaterialRequestDocument,
} from "../api/materialRequests";
import { toast } from "react-toastify";
import { useAuthStore } from "../store/authStore";
import { MdClose, MdAdd, MdDelete, MdAttachFile, MdDownload, MdVisibility, MdImage, MdSearch } from "react-icons/md";
import { DocumentViewer } from "../components/DocumentViewer";
import LoadingSkeleton from "@/components/LoadingSkeleton";

interface RequestFormData {
  department: string;
  project: string;
  items: Array<{
    description: string;
    quantity: number;
  }>;
  justification: string;
  urgencyLevel: "normal" | "high" | "urgent";
}

interface RequestWithDocuments extends MaterialRequest {
  documents?: MaterialRequestDocument[];
}

export default function MaterialRequests() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(h);
  }, [searchInput]);
  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<RequestWithDocuments | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [viewerDocument, setViewerDocument] = useState<{ url: string; name: string } | null>(null);
  const [formData, setFormData] = useState<RequestFormData>({
    department: "",
    project: "",
    items: [{ description: "", quantity: 1 }],
    justification: "",
    urgencyLevel: "normal",
  });

  const queryClient = useQueryClient();
  const hasRole = useAuthStore((state) => state.hasRole);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["material-requests", search],
    queryFn: () => materialRequestsApi.getAll({ search, limit: 50 }),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Atomic create with files
  const [createUploadProgress, setCreateUploadProgress] = useState<number | null>(null);
  const [perRequestUploadProgress, setPerRequestUploadProgress] = useState<Record<string, number>>({});
  const createMutation = useMutation({
    mutationFn: ({ data, files }: { data: Partial<MaterialRequest>; files: File[] }) =>
      materialRequestsApi.createWithFiles(data, files, (percent) => setCreateUploadProgress(percent)),
    onSuccess: (result) => {
      // Optimistically add the new request
      queryClient.setQueryData<MaterialRequest[]>(
        ["material-requests", search],
        (old = []) => [result.request, ...old]
      );
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      toast.success("Material request created successfully");
      resetForm();
      setCreateUploadProgress(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
      setCreateUploadProgress(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<MaterialRequest>) =>
      materialRequestsApi.update(editingId!, data),
    onSuccess: (updated) => {
      // Optimistically update the list
      queryClient.setQueryData<MaterialRequest[]>(
        ["material-requests", search],
        (old = []) => old.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      toast.success("Material request updated successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => materialRequestsApi.approve(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<MaterialRequest[]>(
        ["material-requests", search],
        (old = []) => old.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      toast.success("Request approved successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      materialRequestsApi.reject(id, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData<MaterialRequest[]>(
        ["material-requests", search],
        (old = []) => old.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      toast.success("Request rejected successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => materialRequestsApi.delete(id),
    onSuccess: (_: void, id: string) => {
      queryClient.setQueryData<MaterialRequest[]>(
        ["material-requests", search],
        (old = []) => old.filter((r) => r.id !== id)
      );
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      toast.success("Request deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: ({ requestId, file }: { requestId: string; file: File }) =>
      materialRequestsApi.uploadDocument(requestId, file, (percent) =>
        setPerRequestUploadProgress((prev) => ({ ...prev, [requestId]: percent }))
      ),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      toast.success("Document uploaded successfully");
      setPerRequestUploadProgress((prev) => prev);
      // If currently viewing this request, refresh its details for immediate doc list update
      if (viewingRequest && viewingRequest.id === variables.requestId) {
        materialRequestsApi
          .getById(variables.requestId)
          .then((full) => setViewingRequest(full as RequestWithDocuments))
          .catch(() => {});
      }
    },
    onError: (error: any) => {
      toast.error(error.message);
      setPerRequestUploadProgress((prev) => prev);
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => materialRequestsApi.deleteDocument(documentId),
    onSuccess: (_: void, documentId: string) => {
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      toast.success("Document deleted successfully");
      // If viewing, optimistically remove from local documents list
      setViewingRequest((prev) =>
        prev
          ? {
              ...prev,
              documents: (prev.documents || []).filter((d) => d.id !== documentId),
            }
          : prev
      );
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setShowFormModal(false);
    setEditingId(null);
    setAttachmentFiles([]);
    setFormData({
      department: "",
      project: "",
      items: [{ description: "", quantity: 1 }],
      justification: "",
      urgencyLevel: "normal",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.department || !formData.project) {
      toast.error("Department and project are required");
      return;
    }

    if (formData.items.some((item) => !item.description || item.quantity <= 0)) {
      toast.error("Please fill in all material items");
      return;
    }

    const submitData = {
      department: formData.department,
      project: formData.project,
      items: formData.items,
      justification: formData.justification,
      urgencyLevel: formData.urgencyLevel,
    };

    if (editingId) {
      updateMutation.mutate(submitData as Partial<MaterialRequest>);
    } else {
      // Atomic create with files
      createMutation.mutate({ data: submitData, files: attachmentFiles });
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof RequestFormData["items"][0],
    value: any
  ) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      [field]: field === "description" ? value : parseFloat(value) || 0,
    };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: 1 }],
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    setAttachmentFiles(files);
  };

  const removeFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleView = async (request: RequestWithDocuments) => {
    try {
      const full = await materialRequestsApi.getById(request.id);
      setViewingRequest(full as RequestWithDocuments);
      setShowViewModal(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewDocument = async (documentId: string, fileName: string) => {
    try {
      const url = await materialRequestsApi.getDocumentUrl(documentId);
      setViewerDocument({ url, name: fileName });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewFirstDocument = async (request: RequestWithDocuments) => {
    try {
      let documents = request.documents || [];
      if (!documents.length) {
        const full = await materialRequestsApi.getById(request.id);
        documents = (full.documents || []) as MaterialRequestDocument[];
      }
      if (!documents.length) {
        toast.error("No documents uploaded for this request");
        return;
      }
      const first = documents[0];
      handleViewDocument(first.id, first.fileName);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>, requestId: string) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    if (files.length === 0) return;

    files.forEach((file) => {
      uploadDocumentMutation.mutate({ requestId, file });
    });

    e.target.value = "";
  };

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      procured: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getUrgencyColor = (urgency: string) => {
    const colors: Record<string, string> = {
      normal: "text-gray-600 dark:text-gray-400",
      high: "text-orange-600 dark:text-orange-400 font-semibold",
      urgent: "text-red-600 dark:text-red-400 font-bold",
    };
    return colors[urgency] || "text-gray-600";
  };

  if (isLoading) {
    return (
      <LoadingSkeleton />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Material Requests
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage material requests and approvals
          </p>
        </div>
        {hasRole(["admin", "engineer", "procurement_officer"]) && (
          <button
            onClick={() => setShowFormModal(true)}
            className="btn btn-primary"
          >
            Create Request
          </button>
        )}
      </div>

      <div className="card dark:bg-gray-800">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search requests..."
            className="input dark:bg-gray-700 dark:text-white pr-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(searchInput);
            }}
          />
          <button
            onClick={() => setSearch(searchInput)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Search"
          >
            <MdSearch className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr className="dark:border-gray-600">
                <th className="dark:text-gray-300">Request #</th>
                <th className="dark:text-gray-300">Project</th>
                <th className="dark:text-gray-300">Department</th>
                <th className="dark:text-gray-300">Urgency</th>
                <th className="dark:text-gray-300">Status</th>
                <th className="dark:text-gray-300">Created</th>
                <th className="dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No material requests found
                  </td>
                </tr>
              ) : (
                requests.map((request: any) => (
                  <tr 
                    key={request.id} 
                    className="dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => handleView(request)}
                  >
                    <td className="font-medium dark:text-gray-300">
                      {request.requestNumber}
                    </td>
                    <td className="dark:text-gray-300">{request.project || "N/A"}</td>
                    <td className="dark:text-gray-300">
                      {request.department || "N/A"}
                    </td>
                    <td>
                      <span className={getUrgencyColor(request.urgencyLevel || "normal")}>
                        {request.urgencyLevel || "normal"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`px-2 py-1 text-xs rounded-md ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="dark:text-gray-300">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex space-x-2">
                        <button
                          onClick={() =>
                            handleViewFirstDocument(request as RequestWithDocuments)
                          }
                          title="View request documents"
                        >
                          <MdVisibility className="w-5 h-5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" />
                        </button>
                        {hasRole(["admin", "procurement_officer"]) &&
                          request.status === "pending" && (
                            <>
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Approve this material request?"
                                    )
                                  ) {
                                    approveMutation.mutate(request.id);
                                  }
                                }}
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  const reason = window.prompt(
                                    "Enter rejection reason:"
                                  );
                                  if (reason) {
                                    rejectMutation.mutate({ id: request.id, reason });
                                  }
                                }}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        {hasRole(["admin", "engineer"]) && !editingId && (
                          <button
                            onClick={() => {
                              setEditingId(request.id);
                              setFormData({
                                department: request.department || "",
                                project: request.project || "",
                                items: Array.isArray(request.items)
                                  ? request.items
                                  : [],
                                justification: request.justification || "",
                                urgencyLevel: request.urgencyLevel || "normal",
                              });
                              setShowFormModal(true);
                            }}
                            className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                          >
                            Edit
                          </button>
                        )}
                        {hasRole("admin") && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Are you sure you want to delete this request?"
                                )
                              ) {
                                deleteMutation.mutate(request.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#132f4c] rounded-md max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex justify-between items-center p-6 border-b dark:border-[#3f51b5] bg-white dark:bg-[#132f4c]">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Material Request" : "Create Material Request"}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <MdClose className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Department and Project */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Department *
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Engineering"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project *
                  </label>
                  <input
                    type="text"
                    value={formData.project}
                    onChange={(e) =>
                      setFormData({ ...formData, project: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Project Alpha"
                    required
                  />
                </div>
              </div>

              {/* Materials */}
              <div className="bg-white dark:bg-[#0f1929] p-4 rounded-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Materials Required
                </h3>

                {formData.items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-3 mb-4 pb-4 border-b dark:border-gray-600 last:border-0"
                  >
                    <div className="col-span-8">
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(index, "description", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Material name or description"
                        required
                      />
                    </div>

                    <div className="col-span-3 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, "quantity", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="1"
                          required
                        />
                      </div>

                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2"
                        >
                          <MdDelete className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center space-x-2 text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mt-4"
                >
                  <MdAdd className="w-5 h-5" />
                  <span>Add Material</span>
                </button>
              </div>

              {/* Justification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Justification
                </label>
                <textarea
                  value={formData.justification}
                  onChange={(e) =>
                    setFormData({ ...formData, justification: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Why are these materials needed?"
                />
              </div>

              {/* Urgency Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Urgency Level
                </label>
                <select
                  value={formData.urgencyLevel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      urgencyLevel: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* File Upload Section (only for new requests) */}
              {!editingId && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-md p-4">
                  <label className="flex items-center space-x-2 text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    <MdAttachFile className="w-5 h-5" />
                    <span>Supporting Documents (Optional - Max 3)</span>
                  </label>
                  {createUploadProgress !== null && (
                    <div className="mb-2">
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 transition-all"
                          style={{ width: `${createUploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Uploading {createUploadProgress}%</p>
                    </div>
                  )}
                  <input
                    type="file"
                    multiple
                    max={3}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="flex-1 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 w-full"
                  />
                  {attachmentFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {attachmentFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded-md"
                        >
                          <div className="flex items-center space-x-2">
                            {isImage(file.name) && <MdImage className="w-4 h-4 text-green-600" />}
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {file.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <MdClose className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Documents Section - Only shown when editing */}
              {editingId && (
                <div className="border-t pt-4 dark:border-gray-600">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Supporting Documents
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      (Upload additional supporting files)
                      (Max 3)
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      {editingId && perRequestUploadProgress[editingId] !== undefined && perRequestUploadProgress[editingId] > 0 && perRequestUploadProgress[editingId] < 100 && (
                        <div className="mb-2">
                          <div className="w-full h-1.5 bg-gray-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 transition-all"
                              style={{ width: `${perRequestUploadProgress[editingId]}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Uploading {perRequestUploadProgress[editingId]}%</p>
                        </div>
                      )}
                      <input
                        type="file"
                        id={`doc-upload-${editingId}`}
                        onChange={(e) => handleDocumentUpload(e, editingId)}
                        multiple
                        max={3}
                        className="flex-1 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        disabled={uploadDocumentMutation.isPending}
                      />
                    </div>

                    {/* Documents List */}
                    {editingId && (
                      <div>
                        {(requests.find((r: any) => r.id === editingId) as RequestWithDocuments)?.documents && 
                        (requests.find((r: any) => r.id === editingId) as RequestWithDocuments)!.documents!.length > 0 ? (
                          <div className="space-y-2">
                            {(requests.find((r: any) => r.id === editingId) as RequestWithDocuments)!.documents!.map((doc: any) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  {isImage(doc.fileName) ? (
                                    <MdImage className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <MdAttachFile className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {doc.fileName}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {new Date(doc.uploadedAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2 ml-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleViewDocument(doc.id, doc.fileName)}
                                    title="View document"
                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                  >
                                    <MdVisibility className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      materialRequestsApi.downloadDocument(doc.id, doc.fileName);
                                    }}
                                    title="Download document"
                                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                  >
                                    <MdDownload className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm("Delete this document?")) {
                                        deleteDocumentMutation.mutate(doc.id);
                                      }
                                    }}
                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    <MdDelete className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            No documents uploaded yet
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t dark:border-gray-600">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {editingId ? "Update" : "Create"} Request
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn bg-gray-300 text-gray-900 hover:bg-gray-400 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-md p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {viewingRequest.requestNumber}
                </h2>
                <span
                  className={`inline-block mt-2 px-3 py-1 text-sm rounded-md ${getStatusColor(
                    viewingRequest.status
                  )}`}
                >
                  {viewingRequest.status}
                </span>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                <MdClose className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Project:</span>
                  <p className="text-gray-900 dark:text-white">{viewingRequest.project}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Department:</span>
                  <p className="text-gray-900 dark:text-white">{viewingRequest.department}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Urgency:</span>
                  <p className={getUrgencyColor(viewingRequest.urgencyLevel || "normal")}>
                    {viewingRequest.urgencyLevel || "normal"}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Created:</span>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(viewingRequest.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Materials List */}
            <div className="border-t dark:border-gray-600 pt-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Requested Materials
              </h3>
              <div className="space-y-2">
                {Array.isArray(viewingRequest.items) ? (
                  viewingRequest.items.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                    >
                      <span className="text-gray-900 dark:text-white">{item.description}</span>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Qty: {item.quantity}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No items found</p>
                )}
              </div>
            </div>

            {viewingRequest.justification && (
              <div className="border-t dark:border-gray-600 pt-4 mb-6">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Justification:</span>
                <p className="text-gray-900 dark:text-white mt-2">{viewingRequest.justification}</p>
              </div>
            )}

            {/* Documents Section */}
            {viewingRequest.documents && viewingRequest.documents.length > 0 && (
              <div className="border-t dark:border-gray-600 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Supporting Documents
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {viewingRequest.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="border dark:border-gray-600 rounded-md p-3 hover:shadow-lg transition-shadow"
                    >
                      {isImage(doc.fileName) ? (
                        <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                          <MdImage className="w-12 h-12 text-gray-400" />
                        </div>
                      ) : (
                        <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-md mb-2 flex items-center justify-center">
                          <MdAttachFile className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      <p className="text-xs text-gray-600 dark:text-gray-300 truncate mb-2">
                        {doc.fileName}
                      </p>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleViewDocument(doc.id, doc.fileName)}
                          className="flex-1 text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700"
                          title="View"
                        >
                          <MdVisibility className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          onClick={() => materialRequestsApi.downloadDocument(doc.id, doc.fileName)}
                          className="flex-1 text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                          title="Download"
                        >
                          <MdDownload className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Viewer */}
      {viewerDocument && (
        <DocumentViewer
          documentUrl={viewerDocument.url}
          documentName={viewerDocument.name}
          isOpen={true}
          onClose={() => setViewerDocument(null)}
        />
      )}
    </div>
  );
}
