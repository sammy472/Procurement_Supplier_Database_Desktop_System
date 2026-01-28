import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suppliersApi, Supplier } from "../api/suppliers";
import { toast } from "react-toastify";
import { useAuthStore } from "../store/authStore";
import { MdStar, MdAttachFile, MdClose, MdDownload, MdVisibility, MdImage, MdSearch } from "react-icons/md";
import React from "react";
import { DocumentViewer } from "../components/DocumentViewer";

interface SupplierWithDocuments extends Supplier {
  documents?: Array<{
    id: string;
    fileName?: string;
    fileType?: string;
    filePath?: string;
    uploadedAt: string;
  }>;
}

export default function Suppliers() {
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
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<SupplierWithDocuments | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithDocuments | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [editingFiles, setEditingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editUploadProgress, setEditUploadProgress] = useState<number | null>(null);
  const [viewerDocument, setViewerDocument] = useState<{ url: string; name: string } | null>(null);
  
  const queryClient = useQueryClient();
  const hasRole = useAuthStore((state) => state.hasRole);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", search],
    queryFn: () => suppliersApi.getAll({ search, limit: 50 }),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: ({ data, files }: { data: Partial<Supplier>; files: File[] }) =>
      suppliersApi.createWithFiles(data, files, (percent) => setUploadProgress(percent)),
    onSuccess: (result) => {
      // Optimistically prepend the new supplier
      queryClient.setQueryData<Supplier[]>(
        ["suppliers", search],
        (old = []) => [result.supplier, ...old]
      );
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier created successfully");
      setIsFormModalOpen(false);
      setEditingSupplier(null);
      setAttachmentFiles([]);
      setUploadProgress(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
      setUploadProgress(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, files }: { id: string; data: Partial<Supplier>; files?: File[] }) => {
      const updated = await suppliersApi.update(id, data);
      if (files && files.length > 0) {
        let lastProgress = 0;
        for (const file of files) {
          await suppliersApi.uploadDocument(id, file, (percent) => {
            lastProgress = percent;
            setEditUploadProgress(percent);
          });
        }
        if (lastProgress === 100) {
          setEditUploadProgress(100);
        }
      }
      return updated;
    },
    onSuccess: (updated) => {
      // Optimistically update the supplier list
      queryClient.setQueryData<Supplier[]>(
        ["suppliers", search],
        (old = []) => old.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
      );
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier updated successfully");
      setIsFormModalOpen(false);
      setEditingSupplier(null);
      setEditingFiles([]);
      setEditUploadProgress(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
      setEditUploadProgress(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.delete(id),
    onSuccess: (_: void, id: string) => {
      // Optimistically remove from list
      queryClient.setQueryData<Supplier[]>(
        ["suppliers", search],
        (old = []) => old.filter((s) => s.id !== id)
      );
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });


  /*
  const uploadDocumentMutation = useMutation({
    mutationFn: ({ supplierId, file }: { supplierId: string; file: File }) =>
      suppliersApi.uploadDocument(supplierId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Document uploaded successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
  */

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => suppliersApi.deleteDocument(documentId),
    onSuccess: (_: void, documentId: string) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Document deleted successfully");
      // If viewing supplier, optimistically remove document
      setViewingSupplier((prev) =>
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Partial<Supplier> = {
      name: formData.get("name") as string,
      category: formData.get("category") as string,
      address: formData.get("address") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      country: formData.get("country") as string,
      contactPerson: formData.get("contactPerson") as string,
      reliabilityRating: parseInt(formData.get("reliabilityRating") as string) || 3,
      notes: formData.get("notes") as string,
      isActive: formData.get("isActive") === "on",
    };

    if (editingSupplier) {
      // Update with optional files
      updateMutation.mutate({ id: editingSupplier.id, data, files: editingFiles.length > 0 ? editingFiles : undefined });
    } else {
      // Atomic create with files
      createMutation.mutate({ data, files: attachmentFiles });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    setAttachmentFiles(files);
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    setEditingFiles(files);
  };

  const removeFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeEditFile = (index: number) => {
    setEditingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = async (supplier: Supplier) => {
    try {
      const fullSupplier = await suppliersApi.getById(supplier.id);
      setEditingSupplier(fullSupplier as SupplierWithDocuments);
      setEditingFiles([]);
      setIsFormModalOpen(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleView = async (supplier: Supplier) => {
    // Fetch full supplier details with documents
    try {
      const fullSupplier = await suppliersApi.getById(supplier.id);
      setViewingSupplier(fullSupplier as SupplierWithDocuments);
      setIsViewModalOpen(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewDocument = async (documentId: string, fileName: string) => {
    try {
      const url = await suppliersApi.getDocumentUrl(documentId);
      setViewerDocument({ url, name: fileName });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  /*
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>, supplierId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocumentMutation.mutate({ supplierId, file });
      e.target.value = "";
    }
  };
  */

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block">
            <div className="w-12 h-12 border-4 border-gray-300 dark:border-[#3f51b5] border-t-primary-500 rounded-se-md rounded-es-md animate-spin"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading suppliers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Suppliers</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your supplier database
          </p>
        </div>
        {hasRole(["admin", "procurement_officer"]) && (
          <button
            onClick={() => {
              setEditingSupplier(null);
              setAttachmentFiles([]);
              setIsFormModalOpen(true);
            }}
            className="btn btn-primary"
          >
            Add Supplier
          </button>
        )}
      </div>

      <div className="card">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search suppliers..."
            className="input pr-10"
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
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Country</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr 
                  key={supplier.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => handleView(supplier)}
                >
                  <td>{supplier.name}</td>
                  <td>{supplier.category || "N/A"}</td>
                  <td>{supplier.email || "N/A"}</td>
                  <td>{supplier.phone || "N/A"}</td>
                  <td>{supplier.country || "N/A"}</td>
                  <td>
                    <div className="flex">
                      {supplier.reliabilityRating
                        ? Array.from({ length: supplier.reliabilityRating }).map((_, i) => (
                            <MdStar key={i} className="w-5 h-5 text-yellow-400" />
                          ))
                        : "N/A"}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`px-2 py-1 text-xs rounded-md ${
                        supplier.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {supplier.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex space-x-2">
                      {hasRole(["admin", "procurement_officer"]) && (
                        <>
                          <button
                            onClick={() => handleEdit(supplier)}
                            className="text-primary-600 hover:text-primary-900 dark:text-primary-400"
                          >
                            Edit
                          </button>
                          {hasRole("admin") && (
                            <button
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this supplier?")) {
                                  deleteMutation.mutate(supplier.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-900 dark:text-red-400"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal (Create/Edit) */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-md p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {editingSupplier ? "Edit Supplier" : "Add Supplier"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingSupplier?.name || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <input
                    type="text"
                    name="category"
                    defaultValue={editingSupplier?.category || ""}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Address
                </label>
                <textarea
                  name="address"
                  defaultValue={editingSupplier?.address || ""}
                  className="input"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingSupplier?.email || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone
                  </label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingSupplier?.phone || ""}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    defaultValue={editingSupplier?.country || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    defaultValue={editingSupplier?.contactPerson || ""}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Reliability Rating (1-5)
                  </label>
                  <input
                    type="number"
                    name="reliabilityRating"
                    min="1"
                    max="5"
                    defaultValue={editingSupplier?.reliabilityRating || 3}
                    className="input"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editingSupplier?.isActive !== false}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Active
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <textarea
                  name="notes"
                  defaultValue={editingSupplier?.notes || ""}
                  className="input"
                  rows={3}
                />
              </div>

              {/* File Upload Section */}
              {!editingSupplier && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-md p-4">
                  <label className="flex items-center space-x-2 text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    <MdAttachFile className="w-5 h-5" />
                    <span>Attachments (Optional - Max 3)</span>
                  </label>
                  {uploadProgress !== null && (
                    <div className="mb-2">
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Uploading {uploadProgress}%</p>
                    </div>
                  )}
                  <input
                    type="file"
                    multiple
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

              {/* Edit Mode: Manage Documents */}
              {editingSupplier && (
                <div className="border-t dark:border-gray-600 pt-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Supplier Documents
                  </h3>
                  <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-md p-4 mb-3">
                    <label className="flex items-center space-x-2 text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                      <MdAttachFile className="w-5 h-5" />
                      <span>Add New Documents (Max 3)</span>
                    </label>
                    {editUploadProgress !== null && (
                      <div className="mb-2">
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 transition-all"
                            style={{ width: `${editUploadProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Uploading {editUploadProgress}%</p>
                      </div>
                    )}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      onChange={handleEditFileChange}
                      className="flex-1 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 w-full"
                    />
                    {editingFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {editingFiles.map((file, index) => (
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
                              onClick={() => removeEditFile(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <MdClose className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {editingSupplier.documents && editingSupplier.documents.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Existing Documents
                      </h4>
                      <ul className="space-y-2">
                        {editingSupplier.documents.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md"
                          >
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {doc.fileName}
                            </span>
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={() => handleViewDocument(doc.id, doc.fileName || "document")}
                                className="text-primary-600 hover:text-primary-900 text-sm"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => suppliersApi.downloadDocument(doc.id, doc.fileName)}
                                className="text-green-600 hover:text-green-900 text-sm"
                              >
                                Download
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm("Delete this document?")) {
                                    deleteDocumentMutation.mutate(doc.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-900 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormModalOpen(false);
                    setEditingSupplier(null);
                    setAttachmentFiles([]);
                    setEditingFiles([]);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSupplier ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && viewingSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-md p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {viewingSupplier.name}
              </h2>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                <MdClose className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Category:</span>
                  <p className="text-gray-900 dark:text-white">{viewingSupplier.category || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Email:</span>
                  <p className="text-gray-900 dark:text-white">{viewingSupplier.email || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone:</span>
                  <p className="text-gray-900 dark:text-white">{viewingSupplier.phone || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Country:</span>
                  <p className="text-gray-900 dark:text-white">{viewingSupplier.country || "N/A"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact Person:</span>
                  <p className="text-gray-900 dark:text-white">{viewingSupplier.contactPerson || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Rating:</span>
                  <div className="flex">
                    {viewingSupplier.reliabilityRating
                      ? Array.from({ length: viewingSupplier.reliabilityRating }).map((_, i) => (
                          <MdStar key={i} className="w-5 h-5 text-yellow-400" />
                        ))
                      : "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status:</span>
                  <p>
                    <span
                      className={`px-2 py-1 text-xs rounded-md ${
                        viewingSupplier.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {viewingSupplier.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {viewingSupplier.address && (
              <div className="mt-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Address:</span>
                <p className="text-gray-900 dark:text-white">{viewingSupplier.address}</p>
              </div>
            )}

            {viewingSupplier.notes && (
              <div className="mt-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes:</span>
                <p className="text-gray-900 dark:text-white">{viewingSupplier.notes}</p>
              </div>
            )}

            {/* Documents/Images Section */}
            {viewingSupplier.documents && viewingSupplier.documents.length > 0 && (
              <div className="mt-6 border-t dark:border-gray-600 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Documents & Images
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {viewingSupplier.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="border dark:border-gray-600 rounded-md p-3 hover:shadow-lg transition-shadow"
                    >
                      {isImage(doc.fileName || "") ? (
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
                          onClick={() => handleViewDocument(doc.id, doc.fileName || "document")}
                          className="flex-1 text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700"
                          title="View"
                        >
                          <MdVisibility className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          onClick={() => suppliersApi.downloadDocument(doc.id, doc.fileName)}
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
