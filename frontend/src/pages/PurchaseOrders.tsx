import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, PurchaseOrder } from "../api/purchaseOrders";
import { suppliersApi } from "../api/suppliers";
import { toast } from "react-toastify";
import { useAuthStore } from "../store/authStore";
import { MdClose, MdAdd, MdDelete, MdVisibility, MdSearch } from "react-icons/md";
import { DocumentViewer } from "../components/DocumentViewer";
import LoadingSkeleton from "@/components/LoadingSkeleton";

interface POFormData {
  supplierId: string;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  discount: number;
  vatRate: number;
  expectedDeliveryDate: string;
  paymentTerms: string;
  shippingMethod?: string;
  shippingService?: string;
  status: "draft" | "sent" | "delivered" | "closed";
}

export default function PurchaseOrders() {
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
  const [showModal, setShowModal] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<POFormData>({
    supplierId: "",
    currency: "GHC",
    lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
    subtotal: 0,
    discount: 0,
    vatRate: 0,
    expectedDeliveryDate: new Date().toISOString().split("T")[0],
    paymentTerms: "",
    shippingMethod: "",
    shippingService: "",
    status: "draft",
  });
  const [viewerDocument, setViewerDocument] = useState<{ url: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const hasRole = useAuthStore((state) => state.hasRole);

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", search],
    queryFn: () => purchaseOrdersApi.getAll({ search, limit: 50 }),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-all"],
    queryFn: () => suppliersApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PurchaseOrder>) =>
      purchaseOrdersApi.create(data),
    onSuccess: (po) => {
      // Optimistically add new PO
      queryClient.setQueryData<PurchaseOrder[]>(
        ["purchase-orders", search],
        (old = []) => [po, ...old]
      );
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order created successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<PurchaseOrder>) =>
      purchaseOrdersApi.update(editingId!, data),
    onSuccess: (updated) => {
      // Optimistically update list
      queryClient.setQueryData<PurchaseOrder[]>(
        ["purchase-orders", search],
        (old = []) => old.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order updated successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.delete(id),
    onSuccess: (_: void, id: string) => {
      // Optimistically remove from list
      queryClient.setQueryData<PurchaseOrder[]>(
        ["purchase-orders", search],
        (old = []) => old.filter((p) => p.id !== id)
      );
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const calculateSubtotal = () => {
    return formData.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount:number = (subtotal * formData.discount) / 100;
    const vatAmount:number = ((subtotal - discountAmount) * formData.vatRate) / 100;
    return subtotal - discountAmount + vatAmount;
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      supplierId: "",
      currency: "GHC",
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
      subtotal: 0,
      discount: 0,
      vatRate: 0,
      expectedDeliveryDate: new Date().toISOString().split("T")[0],
      paymentTerms: "",
      status: "draft",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      toast.error("Please select a supplier");
      return;
    }

    if (formData.lineItems.some((item) => !item.description || item.quantity <= 0)) {
      toast.error("Please fill in all line items");
      return;
    }

    const submitData:POFormData = {
      supplierId: formData.supplierId,
      lineItems: formData.lineItems,
      subtotal: calculateSubtotal(),
      discount: formData.discount,
      vatRate: formData.vatRate,
      expectedDeliveryDate: formData.expectedDeliveryDate,
      paymentTerms: formData.paymentTerms,
      status: formData.status,
      currency: formData.currency,
    };

    if (editingId) {
      updateMutation.mutate(submitData as Partial<PurchaseOrder>);
    } else {
      createMutation.mutate(submitData as Partial<PurchaseOrder>);
    }
  };

  const handleLineItemChange = (
    index: number,
    field: keyof POFormData["lineItems"][0],
    value: any
  ) => {
    const newLineItems = [...formData.lineItems];
    newLineItems[index] = {
      ...newLineItems[index],
      [field]: field === "description" ? value : parseFloat(value) || 0,
    };
    setFormData({ ...formData, lineItems: newLineItems });
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      lineItems: [
        ...formData.lineItems,
        { description: "", quantity: 1, unitPrice: 0 },
      ],
    });
  };

  const removeLineItem = (index: number) => {
    setFormData({
      ...formData,
      lineItems: formData.lineItems.filter((_, i) => i !== index),
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
      sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      delivered:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      closed:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const handleView = async (po: PurchaseOrder) => {
    try {
      const fullPO = await purchaseOrdersApi.getById(po.id);
      setViewingPO(fullPO);
      setIsViewModalOpen(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewPDF = async (po: PurchaseOrder) => {
    try {
      const url = await purchaseOrdersApi.exportPDF(po.id, true);
      setViewerDocument({ url, name: `purchase-order-${po.poNumber}.pdf` });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (isLoading) {
    return (
      <LoadingSkeleton/>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Purchase Orders
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage purchase orders
          </p>
        </div>
        {hasRole(["admin", "procurement_officer"]) && (
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
          >
            Create Purchase Order
          </button>
        )}
      </div>

      <div className="card dark:bg-gray-800">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search purchase orders..."
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
                <th className="dark:text-gray-300">PO #</th>
                <th className="dark:text-gray-300">Supplier</th>
                <th className="dark:text-gray-300">Total</th>
                <th className="dark:text-gray-300">Status</th>
                <th className="dark:text-gray-300">Expected Delivery</th>
                <th className="dark:text-gray-300">Created</th>
                <th className="dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No purchase orders found
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po: any) => (
                  <tr 
                    key={po.id} 
                    className="dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => handleView(po)}
                  >
                    <td className="font-medium dark:text-gray-300">
                      {po.poNumber}
                    </td>
                    <td className="dark:text-gray-300">
                      {po.supplierName || po.supplier?.name || "N/A"}
                    </td>
                    <td className="dark:text-gray-300">
                      {po.currency || "GHC"} {parseFloat(po.total).toFixed(2)}
                    </td>
                    <td>
                      <span
                        className={`px-2 py-1 text-xs rounded-se-md rounded-es-md ${getStatusColor(
                          po.status
                        )}`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="dark:text-gray-300">
                      {po.expectedDeliveryDate
                        ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="dark:text-gray-300">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex space-x-2">
                        {hasRole(["admin", "procurement_officer"]) && (
                          <button
                            onClick={() => {
                              setEditingId(po.id);
                              setFormData({
                                supplierId: po.supplierId,
                                currency: po.currency || "GHC",
                                lineItems: Array.isArray(po.lineItems)
                                  ? po.lineItems
                                  : [],
                                subtotal: po.subtotal || 0,
                                discount: po.discount || 0,
                                vatRate: po.vatRate || 0,
                                expectedDeliveryDate:
                                  po.expectedDeliveryDate || "",
                                paymentTerms: po.paymentTerms || "",
                                status: po.status,
                              });
                              setShowModal(true);
                            }}
                            className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewPDF(po);
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                          title="View PDF"
                        >
                          <MdVisibility className="w-5 h-5" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await purchaseOrdersApi.exportPDF(po.id, false);
                              toast.success("PDF downloaded successfully");
                            } catch (error: any) {
                              toast.error(error.message);
                            }
                          }}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          title="Download PDF"
                        >
                          PDF
                        </button>
                        {hasRole("admin") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  "Are you sure you want to delete this purchase order?"
                                )
                              ) {
                                deleteMutation.mutate(po.id);
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#132f4c] rounded-se-md rounded-es-md max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex justify-between items-center p-6 border-b dark:border-[#3f51b5] bg-white dark:bg-[#132f4c]">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Purchase Order" : "Create Purchase Order"}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <MdClose className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Supplier Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Supplier *
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) =>
                      setFormData({ ...formData, supplierId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Select a supplier</option>
                    {suppliers.map((supplier: any) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Currency Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Currency *
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="GHC">GHC</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                    <option value="NGN">NGN</option>
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div className="bg-white dark:bg-[#0f1929] p-4 rounded-se-md rounded-es-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Line Items
                </h3>

                {formData.lineItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-3 mb-4 pb-4 border-b dark:border-gray-600 last:border-0"
                  >
                    <div className="col-span-4">
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          handleLineItemChange(index, "description", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Item description"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleLineItemChange(index, "quantity", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="1"
                        required
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleLineItemChange(index, "unitPrice", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div className="col-span-2 flex items-end">
                      <div className="w-full">
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                          Total
                        </label>
                        <div className="px-3 py-2 bg-gray-100 dark:bg-gray-600 rounded-se-md rounded-es-md text-gray-900 dark:text-white font-medium">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </div>
                      </div>
                      {formData.lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="ml-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2"
                        >
                          <MdDelete className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addLineItem}
                  className="flex items-center space-x-2 text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mt-4"
                >
                  <MdAdd className="w-5 h-5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              {/* Summary Section */}
              <div className="bg-white dark:bg-[#0f1929] p-4 rounded-se-md rounded-es-md border border-gray-200 dark:border-[#3f51b5]">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Summary
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>Subtotal:</span>
                    <span>${calculateSubtotal().toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Discount (%)
                      </label>
                      <input
                        type="number"
                        value={formData.discount}
                        onChange={(e) =>
                          setFormData({ ...formData, discount: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        VAT Rate (%)
                      </label>
                      <input
                        type="number"
                        value={formData.vatRate}
                        onChange={(e) =>
                          setFormData({ ...formData, vatRate: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t dark:border-gray-600">
                    <div className="flex justify-between font-bold text-gray-900 dark:text-white text-lg">
                      <span>Total:</span>
                      <span>${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expectedDeliveryDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shipping Method
                </label>
                <input
                  value={formData.shippingMethod}
                  onChange={(e) =>
                    setFormData({ ...formData, shippingMethod: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter shipping method"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shipping Service
                </label>
                <input
                  value={formData.shippingService}
                  onChange={(e) =>
                    setFormData({ ...formData, shippingService: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter shipping service"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Terms
                </label>
                <textarea
                  value={formData.paymentTerms}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentTerms: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-se-md rounded-es-md dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Enter additional terms"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t dark:border-gray-600">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {editingId ? "Update" : "Create"} Purchase Order
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
      {isViewModalOpen && viewingPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-md p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Purchase Order Details
              </h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setViewingPO(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                <MdClose className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    PO Number
                  </label>
                  <p className="text-gray-900 dark:text-white">{viewingPO.poNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <span className={`px-2 py-1 text-xs rounded-md ${getStatusColor(viewingPO.status)}`}>
                    {viewingPO.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Supplier
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {(viewingPO as any).supplierName || (viewingPO as any).supplier?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Expected Delivery Date
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {viewingPO.expectedDeliveryDate
                      ? new Date(viewingPO.expectedDeliveryDate).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              {viewingPO.lineItems && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Line Items
                  </label>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-gray-600">
                          <th className="text-left py-2 px-2">Description</th>
                          <th className="text-right py-2 px-2">Quantity</th>
                          <th className="text-right py-2 px-2">Unit Price</th>
                          <th className="text-right py-2 px-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(viewingPO.lineItems)
                          ? viewingPO.lineItems
                          : typeof viewingPO.lineItems === "string"
                          ? JSON.parse(viewingPO.lineItems)
                          : []).map((item: any, index: number) => (
                          <tr key={index} className="border-b dark:border-gray-600">
                            <td className="py-2 px-2">{item.description}</td>
                            <td className="text-right py-2 px-2">{item.quantity}</td>
                            <td className="text-right py-2 px-2">{viewingPO.currency || "GHC"} {item.unitPrice.toFixed(2)}</td>
                            <td className="text-right py-2 px-2">{viewingPO.currency || "GHC"} {(item.quantity * item.unitPrice).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="border-t dark:border-gray-600 pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Subtotal:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {viewingPO.currency || "GHC"} {Number(viewingPO.subtotal as any).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Discount ({viewingPO.discount}%):</span>
                    <span className="text-gray-900 dark:text-white">
                      {viewingPO.currency || "GHC"} {(Number((viewingPO.subtotal) * viewingPO.discount/ 100) as any).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">VAT ({viewingPO.vatRate}%):</span>
                    <span className="text-gray-900 dark:text-white">
                      {viewingPO.currency || "GHC"} {Number(viewingPO.vatAmount as any).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t dark:border-gray-600 pt-2 text-lg font-bold">
                    <span className="text-gray-900 dark:text-white">Total:</span>
                    <span className="text-gray-900 dark:text-white">
                      {viewingPO.currency || "GHC"} {Number(viewingPO.total as any).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {viewingPO.paymentTerms && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Terms
                  </label>
                  <p className="text-gray-900 dark:text-white">{viewingPO.paymentTerms}</p>
                </div>
              )}

              <div className="flex space-x-2 pt-4 border-t dark:border-gray-600">
                {hasRole(["admin", "procurement_officer"]) && (
                  <button
                    onClick={() => {
                      setIsViewModalOpen(false);
                      setEditingId(viewingPO.id);
                      setFormData({
                        supplierId: viewingPO.supplierId,
                        currency: viewingPO.currency || "GHC",
                        lineItems: Array.isArray(viewingPO.lineItems)
                          ? viewingPO.lineItems
                          : [],
                        subtotal: viewingPO.subtotal || 0,
                        discount: viewingPO.discount || 0,
                        vatRate: viewingPO.vatRate || 0,
                        expectedDeliveryDate: viewingPO.expectedDeliveryDate || "",
                        paymentTerms: viewingPO.paymentTerms || "",
                        status: viewingPO.status,
                      });
                      setShowModal(true);
                    }}
                    className="btn btn-primary"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleViewPDF(viewingPO)}
                  className="btn btn-secondary"
                >
                  <MdVisibility className="w-5 h-5 mr-2" />
                  View PDF
                </button>
                <button
                  onClick={async () => {
                    try {
                      await purchaseOrdersApi.exportPDF(viewingPO.id, false);
                      toast.success("PDF downloaded successfully");
                    } catch (error: any) {
                      toast.error(error.message);
                    }
                  }}
                  className="btn btn-secondary"
                >
                  Download PDF
                </button>
                {hasRole("admin") && (
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this purchase order?")) {
                        deleteMutation.mutate(viewingPO.id);
                        setIsViewModalOpen(false);
                      }
                    }}
                    className="btn bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
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
