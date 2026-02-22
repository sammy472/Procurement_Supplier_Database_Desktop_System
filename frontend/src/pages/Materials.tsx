import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi, Material, PriceHistory, MaterialDocument } from "../api/materials";
import { suppliersApi } from "../api/suppliers";
import { toast } from "react-toastify";
import { useAuthStore } from "../store/authStore";
import { MdAttachFile, MdDownload, MdDelete, MdVisibility, MdClose, MdImage, MdSearch } from "react-icons/md";
import { DocumentViewer } from "../components/DocumentViewer";
import LoadingSkeleton from "@/components/LoadingSkeleton";


export default function Materials() {
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
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [materialDocuments, setMaterialDocuments] = useState<MaterialDocument[]>([]);
  const [viewerDocument, setViewerDocument] = useState<{ url: string; name: string } | null>(null);
  const [newPrice, setNewPrice] = useState({
    supplierId: "",
    unitPrice: 0,
    currency: "USD",
    leadTime: 0,
    availabilityStatus: "in_stock",
    warrantyNotes: "",
    remarks: "",
  });
  const [createdMaterial, setCreatedMaterial] = useState<Material | null>(null);
  
  const queryClient = useQueryClient();
  const hasRole = useAuthStore((state) => state.hasRole);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials", search],
    queryFn: () => materialsApi.getAll({ search, limit: 50 }),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  console.log("Materials data:", materials);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => suppliersApi.getAll({ isActive: true }),
  });

  // Atomic create with files
  const createMutation = useMutation({
    mutationFn: async (params: { data: Partial<Material>; files: File[]; priceHistory?: Partial<PriceHistory> }) => {
      const { data, files } = params;
      const result = await materialsApi.createWithFiles(data, files, (percent) => setCreateUploadProgress(percent));
      setCreatedMaterial(result.material);
      return result;
    },
    onSuccess: async (result, variables: any) => {
      // Optimistically prepend the new material for immediate UI update
      queryClient.setQueryData<Material[]>(
        ["materials", search],
        (old = []) => [result.material, ...old]
      );

      // Add price history after successful creation without failing the whole mutation
      try {
        const priceHistory = variables?.priceHistory;
        if (priceHistory && priceHistory.supplierId && priceHistory.unitPrice! > 0) {
          await materialsApi.addPriceHistory(result.material.id, priceHistory);
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to add price history");
      }
      
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material created successfully");
      setIsFormModalOpen(false);
      setEditingMaterial(null);
      setAttachmentFiles([]);
      setCreateUploadProgress(null);
      setNewPrice({
        supplierId: "",
        unitPrice: 0,
        currency: "USD",
        leadTime: 0,
        availabilityStatus: "in_stock",
        warrantyNotes: "",
        remarks: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message);
      setCreateUploadProgress(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, priceHistory }: { id: string; data: Partial<Material>; priceHistory?: Partial<PriceHistory> }) => {
      const material = await materialsApi.update(id, data);
      
      // Add price history if provided
      if (priceHistory && priceHistory.supplierId && priceHistory.unitPrice! > 0) {
        await materialsApi.addPriceHistory(material.id, priceHistory);
      }
      
      return material;
    },
    onSuccess: (material) => {
      // Optimistically update the material list
      queryClient.setQueryData<Material[]>(
        ["materials", search],
        (old = []) => old.map((m) => (m.id === material.id ? { ...m, ...material } : m))
      );

      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material updated successfully");
      setIsFormModalOpen(false);
      setEditingMaterial(null);
      setNewPrice({
        supplierId: "",
        unitPrice: 0,
        currency: "USD",
        leadTime: 0,
        availabilityStatus: "in_stock",
        warrantyNotes: "",
        remarks: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => materialsApi.delete(id),
    onSuccess: (_: void, id: string) => {
      // Optimistically remove the material from the list
      queryClient.setQueryData<Material[]>(
        ["materials", search],
        (old = []) => old.filter((m) => m.id !== id)
      );

      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const [materialUploadProgress, setMaterialUploadProgress] = useState<number | null>(null);
  const [createUploadProgress, setCreateUploadProgress] = useState<number | null>(null);
  const uploadDocumentMutation = useMutation({
    mutationFn: ({ materialId, file }: { materialId: string; file: File }) =>
      materialsApi.uploadDocument(materialId, file, (percent) => setMaterialUploadProgress(percent)),
    onSuccess: (doc: MaterialDocument) => {
      toast.success("Document uploaded successfully");
      setMaterialDocuments((prev) => [...prev, doc]);
      setMaterialUploadProgress(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
      setMaterialUploadProgress(null);
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => materialsApi.deleteDocument(documentId),
    onSuccess: (_: void, documentId: string) => {
      toast.success("Document deleted successfully");
      setMaterialDocuments((prev) => prev.filter((d) => d.id !== documentId));
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const loadMaterialDocuments = async (materialId: string) => {
    try {
      const docs = await materialsApi.getDocuments(materialId);
      setMaterialDocuments(docs);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      const url = await materialsApi.getDocumentUrl(documentId);
      const doc = materialDocuments.find((d) => d.id === documentId);
      setViewerDocument({ url, name: doc?.fileName || "document" });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const data: Partial<Material> = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      technicalSpec: formData.get("technicalSpec") as string,
      category: formData.get("category") as string,
      partNumber: formData.get("partNumber") as string,
      unitOfMeasure: formData.get("unitOfMeasure") as string,
      brand: formData.get("brand") as string,
      manufacturer: formData.get("manufacturer") as string,
      defaultSupplierId: formData.get("defaultSupplierId") as string || undefined,
      minimumStockLevel: parseInt(formData.get("minimumStockLevel") as string) || 0,
    };

    // Check if price history is provided
    const priceHistoryData = (formData.get("priceSupplierId") as string) && parseFloat(formData.get("priceUnitPrice") as string || "0") > 0
      ? {
          supplierId: formData.get("priceSupplierId") as string,
          materialId: editingMaterial ? editingMaterial.id : createdMaterial?.id,
          unitPrice: parseFloat(formData.get("priceUnitPrice") as string || "0"),
          currency: (formData.get("priceCurrency") as string) || "USD",
          leadTime: parseInt(formData.get("priceLeadTime") as string || "0"),
          availabilityStatus: (formData.get("priceAvailabilityStatus") as string) || "in_stock",
          warrantyNotes: formData.get("warrantyNotes") as string || "",
          remarks: formData.get("remarks") as string || "",
        }
      : undefined;

    if (editingMaterial) {
      updateMutation.mutate({ id: editingMaterial.id, data, priceHistory: priceHistoryData });
    } else {
      // Atomic create with files - at least one file required for new materials
      if (attachmentFiles.length === 0) {
        toast.error("Please upload at least one document for the new material");
        return;
      }
      createMutation.mutate({ data, files: attachmentFiles, priceHistory: priceHistoryData });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    setAttachmentFiles(files);
  };

  const removeFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleView = async (material: Material) => {
    try {
      const fullMaterial = await materialsApi.getById(material.id);
      const docs = await materialsApi.getDocuments(material.id);
      setMaterialDocuments(docs);
      setViewingMaterial(fullMaterial);
      setIsViewModalOpen(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, materialId: string) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    if (files.length === 0) return;
    for (const file of files) {
      await uploadDocumentMutation.mutateAsync({ materialId, file });
    }
    e.target.value = "";
  };

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  useEffect(() => {
    if (editingMaterial) {
      loadMaterialDocuments(editingMaterial.id);
    }
  }, [editingMaterial]);

  if (isLoading) {
    return (
      <LoadingSkeleton />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Materials</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your material catalog
          </p>
        </div>
        {hasRole(["admin", "procurement_officer"]) && (
          <button
            onClick={() => {
              setEditingMaterial(null);
              setAttachmentFiles([]);
              setIsFormModalOpen(true);
            }}
            className="btn btn-primary"
          >
            Add Material
          </button>
        )}
      </div>

      <div className="card">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search materials..."
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
                <th>Part Number</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr
                  key={material.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => handleView(material)}
                >
                  <td>{material.name}</td>
                  <td>{material.partNumber || "N/A"}</td>
                  <td>{material.category || "N/A"}</td>
                  <td>{material.brand || "N/A"}</td>
                  <td>{material.unitOfMeasure || "N/A"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex space-x-2">
                      {hasRole(["admin", "procurement_officer"]) && (
                        <>
                          <button
                            title="Edit Material"
                            onClick={() => {
                              setEditingMaterial(material);
                              setIsFormModalOpen(true);
                            }}
                            className="text-primary-600 hover:text-primary-900 dark:text-primary-400"
                          >
                            Edit
                          </button>
                          <button
                            title="View Material"
                            onClick={(e) => { e.stopPropagation(); handleView(material); }}
                          >
                            <MdVisibility className="w-5 h-5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" />
                          </button>
                          {hasRole("admin") && (
                            <button
                              title="Delete Material"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Are you sure you want to delete this material?"
                                  )
                                ) {
                                  deleteMutation.mutate(material.id);
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
              {editingMaterial ? "Edit Material" : "Add Material"}
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
                    defaultValue={editingMaterial?.name || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Part Number
                  </label>
                  <input
                    type="text"
                    name="partNumber"
                    defaultValue={editingMaterial?.partNumber || ""}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <input
                    type="text"
                    name="category"
                    defaultValue={editingMaterial?.category || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Unit of Measure
                  </label>
                  <input
                    type="text"
                    name="unitOfMeasure"
                    defaultValue={editingMaterial?.unitOfMeasure || ""}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Brand
                  </label>
                  <input
                    type="text"
                    name="brand"
                    defaultValue={editingMaterial?.brand || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    name="manufacturer"
                    defaultValue={editingMaterial?.manufacturer || ""}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Default Supplier
                </label>
                <select
                  name="defaultSupplierId"
                  defaultValue={editingMaterial?.defaultSupplierId || ""}
                  className="input"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={editingMaterial?.description || ""}
                  className="input"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Technical Specification
                </label>
                <textarea
                  name="technicalSpec"
                  defaultValue={editingMaterial?.technicalSpec || ""}
                  className="input"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Minimum Stock Level
                </label>
                <input
                  type="number"
                  name="minimumStockLevel"
                  min="0"
                  defaultValue={editingMaterial?.minimumStockLevel || 0}
                  className="input"
                />
              </div>

              {/* Price History Section - Available for both create and edit */}
              <div className="border-t dark:border-gray-600 pt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Price History {editingMaterial ? "" : "(Optional)"}
                  </h3>
                  {hasRole(["admin", "procurement_officer"]) && (
                    <button
                      type="button"
                      onClick={() => setShowPriceHistory(!showPriceHistory)}
                      className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                    >
                      {showPriceHistory ? "Hide" : "Add Price"}
                    </button>
                  )}
                </div>

                {showPriceHistory && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded mb-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Supplier *
                      </label>
                      <select
                        name="priceSupplierId"
                        defaultValue={newPrice.supplierId}
                        onChange={(e) =>
                          setNewPrice({ ...newPrice, supplierId: e.target.value })
                        }
                        className="input"
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Unit Price *
                        </label>
                        <input
                          type="number"
                          name="priceUnitPrice"
                          step="0.01"
                          min="0"
                          defaultValue={newPrice.unitPrice}
                          onChange={(e) =>
                            setNewPrice({
                              ...newPrice,
                              unitPrice: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="input"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Currency
                        </label>
                        <select
                          name="priceCurrency"
                          defaultValue={newPrice.currency}
                          onChange={(e) =>
                            setNewPrice({ ...newPrice, currency: e.target.value })
                          }
                          className="input"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="JPY">JPY</option>
                          <option value="AUD">AUD</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Lead Time (days)
                      </label>
                      <input
                        type="number"
                        name="priceLeadTime"
                        min="0"
                        defaultValue={newPrice.leadTime}
                        onChange={(e) =>
                          setNewPrice({
                            ...newPrice,
                            leadTime: parseInt(e.target.value) || 0,
                          })
                        }
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Availability Status
                      </label>
                      <select
                        name="priceAvailabilityStatus"
                        defaultValue={newPrice.availabilityStatus}
                        onChange={(e) =>
                          setNewPrice({
                            ...newPrice,
                            availabilityStatus: e.target.value,
                          })
                        }
                        className="input"
                      >
                        <option value="in_stock">In Stock</option>
                        <option value="limited">Limited</option>
                        <option value="backordered">Backorder</option>
                        <option value="discontinued">Discontinued</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Warranty Notes
                      </label>
                      <textarea
                        name="warrantyNotes"
                        defaultValue={newPrice?.warrantyNotes || ""}
                        className="input"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Remarks
                      </label>
                      <textarea
                        name="remarks"
                        defaultValue={newPrice?.remarks || ""}
                        className="input"
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                {/* Show existing price history for edit mode */}
                {editingMaterial && editingMaterial.priceHistory &&
                  editingMaterial.priceHistory.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Price Records
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b dark:border-gray-600">
                              <th className="text-left py-2 px-2">Supplier</th>
                              <th className="text-left py-2 px-2">Price</th>
                              <th className="text-left py-2 px-2">Lead Time</th>
                              <th className="text-left py-2 px-2">Availability</th>
                              <th className="text-left py-2 px-2">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editingMaterial.priceHistory.map((price: any) => (
                              <tr key={price.id} className="border-b dark:border-gray-600">
                                <td className="py-2 px-2">
                                  {price.supplierName || "Unknown"}
                                </td>
                                <td className="py-2 px-2">
                                  {price.currency} {Number(price.unitPrice).toFixed(3)}
                                </td>
                                <td className="py-2 px-2">{price.leadTime} days</td>
                                <td className="py-2 px-2">
                                  <span className="text-xs capitalize">
                                    {price.availabilityStatus}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(price.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </div>

              {/* File Upload Section */}
              {!editingMaterial && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-md p-4">
                  <label className="flex items-center space-x-2 text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    <MdAttachFile className="w-5 h-5" />
                    <span>Documents * (Required - Max 3)</span>
                  </label>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                    At least one document is required for new materials
                  </p>
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
                    className="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-500/50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 w-full"
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

              {/* Edit Mode: Price History & Documents */}
              {editingMaterial && (
                <>
                  {/* Documents Section */}
                  <div className="border-t dark:border-gray-600 pt-4">
                    <label className="flex items-center space-x-2 text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                      <MdAttachFile className="w-5 h-5" />
                      <span>Documents * (Required - Max 3)</span>
                    </label>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                      At least one document is required for new materials
                    </p>
                    <div>
                      {materialUploadProgress !== null && (
                        <div className="mb-2">
                          <div className="w-full h-1.5 bg-gray-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 transition-all"
                              style={{ width: `${materialUploadProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Uploading {materialUploadProgress}%</p>
                        </div>
                      )}
                      <input
                        type="file"
                        multiple
                        max={3}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={(e) => handleDocumentUpload(e, editingMaterial.id)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm w-full"
                      />
                    </div>
                    {materialDocuments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {materialDocuments.map((doc: any) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-md"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isImage(doc.fileName) ? (
                                <MdImage className="flex-shrink-0 text-green-500" />
                              ) : (
                                <MdAttachFile className="flex-shrink-0 text-gray-500" />
                              )}
                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {doc.fileName}
                              </span>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleViewDocument(doc.id)}
                                title="View document"
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                              >
                                <MdVisibility size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  materialsApi.downloadDocument(doc.id, doc.fileName)
                                }
                                title="Download document"
                                className="text-green-600 hover:text-green-900 dark:text-green-400"
                              >
                                <MdDownload size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm("Delete this document?")) {
                                    deleteDocumentMutation.mutate(doc.id);
                                  }
                                }}
                                disabled={deleteDocumentMutation.isPending}
                                title="Delete document"
                                className="text-red-600 hover:text-red-900 dark:text-red-400 disabled:opacity-50"
                              >
                                <MdDelete size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormModalOpen(false);
                    setEditingMaterial(null);
                    setShowPriceHistory(false);
                    setAttachmentFiles([]);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingMaterial ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && viewingMaterial && (
        <div className="fixed top-0 inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-md p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {viewingMaterial.name}
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
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Part Number:</span>
                  <p className="text-gray-900 dark:text-white">{viewingMaterial.partNumber || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Category:</span>
                  <p className="text-gray-900 dark:text-white">{viewingMaterial.category || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Brand:</span>
                  <p className="text-gray-900 dark:text-white">{viewingMaterial.brand || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Manufacturer:</span>
                  <p className="text-gray-900 dark:text-white">{viewingMaterial.manufacturer || "N/A"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Unit of Measure:</span>
                  <p className="text-gray-900 dark:text-white">{viewingMaterial.unitOfMeasure || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Minimum Stock:</span>
                  <p className="text-gray-900 dark:text-white">{viewingMaterial.minimumStockLevel || 0}</p>
                </div>
              </div>
            </div>

            {viewingMaterial.description && (
              <div className="mt-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Description:</span>
                <p className="text-gray-900 dark:text-white">{viewingMaterial.description}</p>
              </div>
            )}

            {viewingMaterial.technicalSpec && (
              <div className="mt-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Technical Specifications:</span>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{viewingMaterial.technicalSpec}</p>
              </div>
            )}

            {/* Price History Section */}
            {viewingMaterial.priceHistory && viewingMaterial.priceHistory.length > 0 && (
              <div className="mt-6 border-t dark:border-gray-600 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Price History
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b dark:border-gray-600">
                        <th className="text-left py-2">Supplier</th>
                        <th className="text-left py-2">Price</th>
                        <th className="text-left py-2">Lead Time</th>
                        <th className="text-left py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingMaterial.priceHistory.map((price: any) => (
                        <tr key={price.id} className="border-b dark:border-gray-600">
                          <td className="py-2">{price.supplierName || "Unknown"}</td>
                          <td className="py-2">{price.currency} {price.unitPrice}</td>
                          <td className="py-2">{price.leadTime} days</td>
                          <td className="py-2 text-xs text-gray-500">
                            {new Date(price.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* Documents/Images Section */}
            {materialDocuments && materialDocuments.length > 0 && (
              <div className="mt-6 border-t dark:border-gray-600 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Documents & Images
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {materialDocuments.map((doc) => (
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
                          onClick={() => handleViewDocument(doc.id)}
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
