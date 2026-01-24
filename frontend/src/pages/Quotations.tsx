import { ChangeEventHandler, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quotationsApi, Quotation, QuotationLineItem } from "../api/quotations";
import { toast } from "react-toastify";
import { useAuthStore } from "../store/authStore";
import { MdVisibility, MdClose, MdSearch, MdEmail } from "react-icons/md";
import { DocumentViewer } from "../components/DocumentViewer";

export default function Quotations() {
  const [currency, setCurrency] = useState("GHC");
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailData, setEmailData] = useState({ recipientEmail: "", subject: "", body: "" });
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>([]);
  const [newLineItem, setNewLineItem] = useState<QuotationLineItem>({
    description: "",
    quantity: 1,
    unitPrice: 0,
    total: 0,
  });
  const [priceInfo, setPriceInfo] = useState<{ nhilrate: number; getfundrate: number;  vatRate: number }>({
    nhilrate: 0,
    getfundrate: 0,
    vatRate: 0
  });
  const [viewerDocument, setViewerDocument] = useState<{ url: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const hasRole = useAuthStore((state) => state.hasRole);

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["quotations", search],
    queryFn: () => quotationsApi.getAll({ search, limit: 50 }),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Quotation>) => quotationsApi.create(data),
    onSuccess: (quotation) => {
      // Optimistically add new quotation
      queryClient.setQueryData<Quotation[]>(
        ["quotations", search],
        (old = []) => [quotation, ...old]
      );
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation created successfully");
      setIsModalOpen(false);
      setEditingQuotation(null);
      setLineItems([]);
      setNewLineItem({
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Quotation> }) =>
      quotationsApi.update(id, data),
    onSuccess: (updated) => {
      // Optimistically update list
      queryClient.setQueryData<Quotation[]>(
        ["quotations", search],
        (old = []) => old.map((q) => (q.id === updated.id ? { ...q, ...updated } : q))
      );
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation updated successfully");
      setIsModalOpen(false);
      setEditingQuotation(null);
      setLineItems([]);
      setNewLineItem({
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotationsApi.delete(id),
    onSuccess: (_: void, id: string) => {
      // Optimistically remove from list
      queryClient.setQueryData<Quotation[]>(
        ["quotations", search],
        (old = []) => old.filter((q) => q.id !== id)
      );
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const emailMutation = useMutation({
    mutationFn: (data: { id: string; recipientEmail: string; subject?: string; body?: string }) =>
      quotationsApi.sendEmail(data.id, data),
    onSuccess: () => {
      toast.success("Email sent successfully");
      setIsEmailModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleAddLineItem = () => {
    if (!newLineItem.description) {
      toast.error("Description is required");
      return;
    }
    if (newLineItem.quantity <= 0 || newLineItem.unitPrice <= 0) {
      toast.error("Quantity and unit price must be greater than 0");
      return;
    }

    const total = newLineItem.quantity * newLineItem.unitPrice;
    setLineItems([...lineItems, { ...newLineItem, total:Number(total.toFixed(2)) }]);
    setNewLineItem({
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
    });
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    return { subtotal:Number(subtotal.toFixed(2)) };
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (lineItems.length === 0) {
      toast.error("Add at least one line item");
      return;
    }

    const { subtotal } = calculateTotals();
    const nhil =  parseFloat(formData.get("nhilRate") as string) || 0;
    const getfund = parseFloat(formData.get("getfundRate") as string) || 0;
    const taxableAmount = (subtotal + (subtotal * (nhil + getfund) / 100));
    const vatRate = parseFloat(formData.get("vatRate") as string) || 0;
    const vatAmount = (taxableAmount * (vatRate / 100));
    const total = (taxableAmount + vatAmount);

    const data: Partial<Quotation> = {
      clientName: formData.get("clientName") as string,
      clientAddress: formData.get("clientAddress") as string,
      clientEmail: formData.get("clientEmail") as string,
      clientPhone: formData.get("clientPhone") as string,
      projectTitle: formData.get("projectTitle") as string,
      projectReference: formData.get("projectReference") as string,
      currency: currency,
      lineItems: lineItems,
      subtotal: subtotal.toString(),
      nhilRate: priceInfo.nhilrate.toString(),
      getfundRate: priceInfo.getfundrate.toString(),
      paymentTerms: formData.get("paymentTerms") as string,
      deliveryTerms: formData.get("deliveryTerms") as string,
      vatRate: priceInfo.vatRate.toString(),
      vatAmount: vatAmount.toFixed(2),
      total: total.toFixed(2),
      deliveryPeriod: formData.get("deliveryPeriod") as string,
      validityPeriod: parseInt(formData.get("validityPeriod") as string) || 30,
      termsAndConditions: formData.get("termsAndConditions") as string,
      status: (formData.get("status") as any) || "draft",
    };

    if (editingQuotation) {
      updateMutation.mutate({ id: editingQuotation.id, data });
    } else {
      console.log(data);
      createMutation.mutate(data);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      accepted: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      expired: "bg-yellow-100 text-yellow-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const openEditModal = async (quotation: Quotation) => {
    try {
      const fullQuotation = await quotationsApi.getById(quotation.id);
      setEditingQuotation(fullQuotation);
      try {
        const items =
          typeof fullQuotation.lineItems === "string"
            ? JSON.parse(fullQuotation.lineItems)
            : fullQuotation.lineItems || [];
        setLineItems(items);
      } catch (e) {
        setLineItems([]);
      }
      setIsModalOpen(true);
    } catch (error) {
      toast.error("Failed to load quotation details");
    }
  };

  const handleView = async (quotation: Quotation) => {
    try {
      const fullQuotation = await quotationsApi.getById(quotation.id);
      setViewingQuotation(fullQuotation);
      setIsViewModalOpen(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewPDF = async (quotation: Quotation) => {
    try {
      const url = await quotationsApi.exportPDF(quotation.id, true);
      setViewerDocument({ url, name: `quotation-${quotation.quotationNumber}.pdf` });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleOpenEmailModal = (quotation: Quotation) => {
    setViewingQuotation(quotation);
    setEmailData({
      recipientEmail: quotation.clientEmail || "",
      subject: `Quotation: ${quotation.quotationNumber}`,
      body: `Dear ${quotation.clientName},\n\nPlease find attached the quotation ${quotation.quotationNumber} for your review.\n\nBest regards,\nProcurement Team`,
    });
    setIsEmailModalOpen(true);
  };

  const handleChangePriceInfo: ChangeEventHandler<HTMLInputElement> = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPriceInfo((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block">
            <div className="w-12 h-12 border-4 border-gray-300 dark:border-[#3f51b5] border-t-primary-500 rounded-se-md rounded-es-md animate-spin"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading quotations...</p>
        </div>
      </div>
    );
  }

  const { subtotal } = calculateTotals();
  const nhil =  priceInfo.nhilrate || 0;
  const getfund = priceInfo.getfundrate || 0;
  const taxableAmount = (subtotal + (subtotal * (nhil + getfund) / 100)).toFixed(2);
  const vatRate = priceInfo.vatRate || 0;
  const vatAmount = (parseFloat(taxableAmount) * (vatRate / 100));
  const total = (parseFloat(taxableAmount) + vatAmount);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage customer quotations
          </p>
        </div>
        {hasRole(["admin", "procurement_officer"]) && (
          <button
            onClick={() => {
              setEditingQuotation(null);
              setLineItems([]);
              setNewLineItem({
                description: "",
                quantity: 1,
                unitPrice: 0,
                total: 0,
              });
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
          >
            Create Quotation
          </button>
        )}
      </div>

      <div className="card">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search quotations..."
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
                <th>Quotation #</th>
                <th>Client Name</th>
                <th>Project</th>
                <th>Total</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No quotations found
                  </td>
                </tr>
              ) : (
                quotations.map((quotation) => (
                  <tr 
                    key={quotation.id}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => handleView(quotation)}
                  >
                    <td className="font-medium">{quotation.quotationNumber}</td>
                    <td>{quotation.clientName}</td>
                    <td>{quotation.projectTitle || "N/A"}</td>
                    <td>{quotation.currency}{parseFloat(quotation.total).toFixed(2)}</td>
                    <td>
                      <span
                        className={`px-2 py-1 text-xs rounded-se-md rounded-es-md ${getStatusColor(
                          quotation.status
                        )}`}
                      >
                        {quotation.status}
                      </span>
                    </td>
                    <td>
                      {new Date(quotation.createdAt).toLocaleDateString()}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex space-x-2">
                        {hasRole(["admin", "procurement_officer"]) && (
                          <button
                            onClick={() => openEditModal(quotation)}
                            className="text-primary-600 hover:text-primary-900 dark:text-primary-400"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewPDF(quotation);
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
                              await quotationsApi.exportPDF(quotation.id, false);
                              toast.success("PDF downloaded successfully");
                            } catch (error: any) {
                              toast.error(error.message);
                            }
                          }}
                          className="text-green-600 hover:text-green-900 dark:text-green-400"
                          title="Download PDF"
                        >
                          📄 PDF
                        </button>
                        {hasRole("admin") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  "Are you sure you want to delete this quotation?"
                                )
                              ) {
                                deleteMutation.mutate(quotation.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-900 dark:text-red-400"
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-se-md rounded-es-md p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {editingQuotation ? "Edit Quotation" : "Create Quotation"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    name="clientName"
                    required
                    defaultValue={editingQuotation?.clientName || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Project Title
                  </label>
                  <input
                    type="text"
                    name="projectTitle"
                    defaultValue={editingQuotation?.projectTitle || ""}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Client Email
                  </label>
                  <input
                    type="email"
                    name="clientEmail"
                    defaultValue={editingQuotation?.clientEmail || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Client Phone
                  </label>
                  <input
                    type="tel"
                    name="clientPhone"
                    defaultValue={editingQuotation?.clientPhone || ""}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Client Address
                </label>
                <textarea
                  name="clientAddress"
                  defaultValue={editingQuotation?.clientAddress || ""}
                  className="input"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Project Reference or Tender Number
                  </label>
                  <input
                    type="text"
                    name="projectReference"
                    defaultValue={editingQuotation?.projectReference || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Delivery Period
                  </label>
                  <input
                    type="text"
                    name="deliveryPeriod"
                    placeholder="e.g., 2-3 weeks"
                    defaultValue={editingQuotation?.deliveryPeriod || ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Transaction Currency
                  </label>
                  <select
                    name="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="input"
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

              <div className="border-t border-gray-200 dark:border-[#3f51b5] pt-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Line Items
                </h3>
                
                {lineItems.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Description</th>
                          <th className="text-right py-2 px-2">Quantity</th>
                          <th className="text-right py-2 px-2">Unit Price</th>
                          <th className="text-right py-2 px-2">Total</th>
                          <th className="text-center py-2 px-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2 px-2">{item.description}</td>
                            <td className="text-right py-2 px-2">{item.quantity}</td>
                            <td className="text-right py-2 px-2">
                              {currency+item.unitPrice.toFixed(2)}
                            </td>
                            <td className="text-right py-2 px-2">
                              {currency+item.total.toFixed(2)}
                            </td>
                            <td className="text-center py-2 px-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(index)}
                                className="text-red-600 hover:text-red-900 text-sm"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-[#0f1929] p-4 rounded-se-md rounded-es-md mb-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description *
                    </label>
                    <textarea
                      value={newLineItem.description}
                      onChange={(e) =>
                        setNewLineItem({ ...newLineItem, description: e.target.value })
                      }
                      className="input"
                      rows={2}
                      placeholder="Item description"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newLineItem.quantity}
                        onChange={(e) =>
                          setNewLineItem({
                            ...newLineItem,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Unit Price *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newLineItem.unitPrice}
                        onChange={(e) =>
                          setNewLineItem({
                            ...newLineItem,
                            unitPrice: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="input"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Total
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`${currency}${(newLineItem.quantity * newLineItem.unitPrice).toFixed(2)}`}
                        className="input bg-gray-100 dark:bg-[#0f1929]"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="w-full btn btn-primary text-sm"
                  >
                    Add Line Item
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-[#3f51b5] pt-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Summary
                </h3>
                
                <div className="space-y-2 mb-4 text-sm text-gray-900 dark:text-gray-100">
                  <div className="flex justify-between">
                    <span className="text-yellow-50">Subtotal:</span>
                    <span className="font-medium text-yellow-50">{currency+subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      NHIL Rate (%)
                    </label>
                    <input
                      type="number"
                      name="nhilrate"
                      step="0.01"
                      min="0"
                      onChange={handleChangePriceInfo}
                      defaultValue={editingQuotation ? parseFloat(editingQuotation.nhilRate!) : 0}
                      className="input w-32"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      GETFUND Rate (%)
                    </label>
                    <input
                      type="number"
                      name="getfundrate"
                      step="0.01"
                      min="0"
                      onChange={handleChangePriceInfo}
                      defaultValue={editingQuotation ? parseFloat(editingQuotation.getfundRate!) : 0}
                      className="input w-32"
                    />
                  </div>

                  <div className="flex justify-between">
                    <span className="text-yellow-50">Taxable Amount:</span>
                    <span className="font-medium text-yellow-50">
                      {currency+taxableAmount}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      VAT Rate (%) 
                    </label>
                    <input
                      type="number"
                      name="vatRate"
                      step="0.01"
                      min="0"
                      max="100"
                      onChange={handleChangePriceInfo}
                      defaultValue={editingQuotation ? parseFloat(editingQuotation.vatRate) : 0}
                      className="input w-32"
                    />
                  </div>

                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>VAT Amount ({vatRate}%):</span>
                    <span>{currency+vatAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between border-t border-gray-200 dark:border-[#3f51b5] pt-2 text-lg">
                    <span className="font-bold text-gray-900 dark:text-white">Total:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{currency+total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Validity Period (days)
                  </label>
                  <input
                    type="number"
                    name="validityPeriod"
                    min="1"
                    defaultValue={editingQuotation?.validityPeriod || 30}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue={editingQuotation?.status || "draft"}
                    className="input"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payment Terms and Conditions
                </label>
                <textarea
                  name="paymentTerms"
                  defaultValue={editingQuotation?.paymentTerms || ""}
                  className="input"
                  rows={3}
                  placeholder="Payment terms, delivery conditions, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Delivery Terms and Conditions
                </label>
                <textarea
                  name="deliveryTerms"
                  defaultValue={editingQuotation?.deliveryTerms || ""}
                  className="input"
                  rows={3}
                  placeholder="Delivery terms, conditions, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Terms and Conditions
                </label>
                <textarea
                  name="termsAndConditions"
                  defaultValue={editingQuotation?.termsAndConditions || ""}
                  className="input"
                  rows={3}
                  placeholder="Legal terms and conditions..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingQuotation(null);
                    setLineItems([]);
                    setNewLineItem({
                      description: "",
                      quantity: 1,
                      unitPrice: 0,
                      total: 0,
                    });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingQuotation
                    ? "Update"
                    : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && viewingQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-md p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Quotation Details
              </h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setViewingQuotation(null);
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
                    Quotation Number
                  </label>
                  <p className="text-gray-900 dark:text-white">{viewingQuotation.quotationNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <span className={`px-2 py-1 text-xs rounded-md ${getStatusColor(viewingQuotation.status)}`}>
                    {viewingQuotation.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Client Name
                  </label>
                  <p className="text-gray-900 dark:text-white">{viewingQuotation.clientName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Project Title
                  </label>
                  <p className="text-gray-900 dark:text-white">{viewingQuotation.projectTitle || "N/A"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Client Email
                  </label>
                  <p className="text-gray-900 dark:text-white">{viewingQuotation.clientEmail || "N/A"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Client Phone
                  </label>
                  <p className="text-gray-900 dark:text-white">{viewingQuotation.clientPhone || "N/A"}</p>
                </div>
              </div>

              {viewingQuotation.clientAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Client Address
                  </label>
                  <p className="text-gray-900 dark:text-white">{viewingQuotation.clientAddress}</p>
                </div>
              )}

              {viewingQuotation.lineItems && (
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
                        {(typeof viewingQuotation.lineItems === "string"
                          ? JSON.parse(viewingQuotation.lineItems)
                          : viewingQuotation.lineItems || []).map((item: QuotationLineItem, index: number) => (
                          <tr key={index} className="border-b dark:border-gray-600">
                            <td className="py-2 px-2">{item.description}</td>
                            <td className="text-right py-2 px-2">{item.quantity}</td>
                            <td className="text-right py-2 px-2">{viewingQuotation.currency+item.unitPrice.toFixed(2)}</td>
                            <td className="text-right py-2 px-2">{viewingQuotation.currency+item.total.toFixed(2)}</td>
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
                      {viewingQuotation.currency+parseFloat(viewingQuotation.subtotal).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">VAT ({viewingQuotation.vatRate}%):</span>
                    <span className="text-gray-900 dark:text-white">
                      {viewingQuotation.currency+parseFloat(viewingQuotation.vatAmount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t dark:border-gray-600 pt-2 text-lg font-bold">
                    <span className="text-gray-900 dark:text-white">Total:</span>
                    <span className="text-gray-900 dark:text-white">
                      {viewingQuotation.currency+parseFloat(viewingQuotation.total).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2 pt-4 border-t dark:border-gray-600">
                {hasRole(["admin", "procurement_officer"]) && (
                  <button
                    onClick={() => {
                      setIsViewModalOpen(false);
                      openEditModal(viewingQuotation);
                    }}
                    className="btn btn-primary"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleViewPDF(viewingQuotation)}
                  className="btn btn-secondary"
                >
                  <MdVisibility className="w-5 h-5 mr-2" />
                  View PDF
                </button>
                <button
                  onClick={() => handleOpenEmailModal(viewingQuotation)}
                  className="btn btn-secondary"
                >
                  <MdEmail className="w-5 h-5 mr-2" />
                  Mail
                </button>
                <button
                  onClick={async () => {
                    try {
                      await quotationsApi.exportPDF(viewingQuotation.id, false);
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
                      if (window.confirm("Are you sure you want to delete this quotation?")) {
                        deleteMutation.mutate(viewingQuotation.id);
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

      {/* Email Modal */}
      {isEmailModalOpen && viewingQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-md p-6 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Email Quotation
              </h2>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                <MdClose className="w-6 h-6" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                emailMutation.mutate({
                  id: viewingQuotation.id,
                  ...emailData,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recipient Email *
                </label>
                <input
                  type="email"
                  required
                  value={emailData.recipientEmail}
                  onChange={(e) =>
                    setEmailData({ ...emailData, recipientEmail: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) =>
                    setEmailData({ ...emailData, subject: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Message
                </label>
                <textarea
                  value={emailData.body}
                  onChange={(e) =>
                    setEmailData({ ...emailData, body: e.target.value })
                  }
                  className="input"
                  rows={5}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailMutation.isPending}
                  className="btn btn-primary"
                >
                  {emailMutation.isPending ? "Sending..." : "Send Email"}
                </button>
              </div>
            </form>
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
