import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceApi } from "../api/invoices";
import { MdSearch, MdOpenInNew, MdClose, MdEdit, MdDelete, MdSave, MdCancel, MdAdd } from "react-icons/md";
import { toast } from "react-toastify";
import { DocumentViewer } from "../components/DocumentViewer";
import LoadingSkeleton from "@/components/LoadingSkeleton";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  quotationNumber?: string;
  baseInvoiceId?: string;
  pricingRuleSnapshot?: any;
  companyProfileSnapshot?: any;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    unit?: string;
    code?: string;
  }[];
  subtotal: number;
  taxTotal?: number;
  total: number;
  currency: string;
  pdfPath?: string;
  status?: string;
  createdAt?: string;
};

export default function Invoices() {
  const queryClient = useQueryClient();
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

  const [selected, setSelected] = useState<InvoiceRow | null>(null);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InvoiceRow>>({});
  const [viewerDocument, setViewerDocument] = useState<{ url: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", search],
    queryFn: () => invoiceApi.getAll(search ? { search } : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: invoiceApi.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["invoices", search] });
      const previousData = queryClient.getQueryData(["invoices", search]);
      
      queryClient.setQueryData(["invoices", search], (old: any) => ({
        ...old,
        invoices: old?.invoices?.filter((i: InvoiceRow) => i.id !== id) || []
      }));

      if (open) handleCloseModal();
      
      return { previousData };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(["invoices", search], context?.previousData);
      toast.error("Failed to delete invoice");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", search] });
    },
    onSuccess: () => {
      toast.success("Invoice deleted successfully");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InvoiceRow> }) => invoiceApi.update(id, data),
    onMutate: async ({ id, data: newData }) => {
      await queryClient.cancelQueries({ queryKey: ["invoices", search] });
      const previousData = queryClient.getQueryData(["invoices", search]);
      
      queryClient.setQueryData(["invoices", search], (old: any) => ({
        ...old,
        invoices: old?.invoices?.map((i: InvoiceRow) => 
          i.id === id ? { ...i, ...newData } : i
        ) || []
      }));

      handleCloseModal();
      
      return { previousData };
    },
    onError: (_err, _variables, context) => {
      queryClient.setQueryData(["invoices", search], context?.previousData);
      toast.error("Failed to update invoice");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", search] });
    },
    onSuccess: () => {
      toast.success("Invoice updated successfully");
    },
  });

  const invoices: InvoiceRow[] = useMemo(() => {
    return data?.invoices || [];
  }, [data]);

  const handleOpenModal = (inv: InvoiceRow, editMode: boolean = false) => {
    setSelected(inv);
    setEditForm(JSON.parse(JSON.stringify(inv))); // Deep copy
    setIsEditing(editMode);
    setOpen(true);
  };

  const handleCloseModal = () => {
    setOpen(false);
    setSelected(null);
    setIsEditing(false);
    setEditForm({});
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSave = () => {
    if (!selected?.id || !editForm) return;
    updateMutation.mutate({ id: selected.id, data: editForm });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    if (!editForm.items) return;
    const newItems = [...editForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate totals
    const subtotal = newItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    const taxTotal = 0; // Keeping simple for now, or preserve existing logic if needed
    const total = subtotal + taxTotal;

    setEditForm({
      ...editForm,
      items: newItems,
      subtotal,
      total
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!editForm.items) return;
    const newItems = editForm.items.filter((_, i) => i !== index);
    
    const subtotal = newItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    const taxTotal = 0;
    const total = subtotal + taxTotal;

    setEditForm({
      ...editForm,
      items: newItems,
      subtotal,
      total
    });
  };

  const handleAddItem = () => {
    if (!editForm.items) return;
    const newItems = [...editForm.items, { description: "New Item", quantity: 1, unitPrice: 0 }];
    setEditForm({ ...editForm, items: newItems });
  };

  const handleOpenPdf = async () => {
    if (!selected) return;
    try {
      const directUrl = (selected as any).pdfUrl;
      if (directUrl) {
        const name = `invoice-${selected.invoiceNumber}.pdf`;
        setViewerDocument({ url: directUrl, name });
        return;
      }
      if (selected.id) {
        const url = await invoiceApi.exportPDF(selected.id, true);
        const name = `invoice-${selected.invoiceNumber}.pdf`;
        setViewerDocument({ url, name });
        return;
      }
      toast.error("No preview URL available for this invoice");
    } catch (error: any) {
      toast.error(error.message || "Failed to open PDF");
    }
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
          <h1 className="page-title">Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage generated invoices
          </p>
        </div>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search invoices..."
            className="input pr-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
                <th>Invoice #</th>
                <th>Client</th>
                <th className="text-right">Total</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">Loading...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">No invoices found</td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr 
                    key={inv.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="font-medium">{inv.invoiceNumber}</td>
                    <td>{inv.clientName}</td>
                    <td className="text-right">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency }).format(inv.total)}
                    </td>
                    <td>{inv.currency}</td>
                    <td>
                      <span className="px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs">
                        {inv.status || "generated"}
                      </span>
                    </td>
                    <td>
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "-"}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenModal(inv)}
                          className="text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                          title="View"
                        >
                          <MdOpenInNew className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(inv, true)}
                          className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                          title="Edit"
                        >
                          <MdEdit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <MdDelete className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && selected && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white dark:bg-[#132f4c] rounded-lg shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b dark:border-gray-700 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {isEditing ? "Edit Invoice" : "Generated Invoice"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <MdClose className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Client Details</h3>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Client Name</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={editForm.clientName || ""}
                          onChange={e => setEditForm({...editForm, clientName: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Invoice Number</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={editForm.invoiceNumber || ""}
                          onChange={e => setEditForm({...editForm, invoiceNumber: e.target.value})}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-medium text-gray-900 dark:text-white text-lg">{selected.clientName}</div>
                      <div className="text-gray-600 dark:text-gray-400">Inv #: {selected.invoiceNumber}</div>
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t dark:border-gray-700">
                     <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Company Profile</h3>
                     <div className="text-sm text-gray-600 dark:text-gray-400">
                        {selected.companyProfileSnapshot?.name}<br/>
                        {selected.companyProfileSnapshot?.address}
                     </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Pricing Rule</h3>
                  <dl className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Margin:</span>
                      <span>{selected.pricingRuleSnapshot?.marginPercent}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>{selected.pricingRuleSnapshot?.discountPercent || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fixed Markup:</span>
                      <span>{selected.pricingRuleSnapshot?.fixedMarkup || 0}</span>
                    </div>
                  </dl>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Items</h3>
                  {isEditing && (
                    <button 
                      onClick={handleAddItem}
                      className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
                    >
                      <MdAdd /> Add Item
                    </button>
                  )}
                </div>
                
                <div className="border rounded-md dark:border-gray-700 overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Item</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300 w-24">Qty</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300 w-32">Price</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300 w-32">Total</th>
                        {isEditing && <th className="w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                      {(isEditing ? editForm.items : selected.items)?.map((it, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                            {isEditing ? (
                              <input 
                                type="text" 
                                className="w-full p-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                                value={it.description}
                                onChange={e => handleItemChange(idx, 'description', e.target.value)}
                              />
                            ) : it.description}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                            {isEditing ? (
                              <input 
                                type="number" 
                                className="w-full p-1 border rounded dark:bg-gray-800 dark:border-gray-600 text-right"
                                value={it.quantity}
                                onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                              />
                            ) : it.quantity}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                            {isEditing ? (
                              <input 
                                type="number" 
                                className="w-full p-1 border rounded dark:bg-gray-800 dark:border-gray-600 text-right"
                                value={it.unitPrice}
                                onChange={e => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                              />
                            ) : new Intl.NumberFormat("en-US", { style: "currency", currency: selected.currency }).format(it.unitPrice)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 font-medium">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: selected.currency }).format(it.quantity * it.unitPrice)}
                          </td>
                          {isEditing && (
                            <td className="px-1 text-center">
                              <button 
                                onClick={() => handleRemoveItem(idx)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <MdDelete />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 space-y-2 text-sm border-t dark:border-gray-700 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: selected.currency }).format(isEditing ? (editForm.subtotal || 0) : selected.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-primary-600 dark:text-primary-400">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: selected.currency }).format(isEditing ? (editForm.total || 0) : selected.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-[#132f4c]/50 rounded-b-lg">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <MdCancel /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 shadow-sm flex items-center gap-2"
                  >
                    <MdSave /> Save Changes
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleOpenPdf}
                    disabled={!selected.pdfPath}
                    className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                      selected.pdfPath 
                        ? "bg-primary-600 text-white hover:bg-primary-700 shadow-sm" 
                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <MdOpenInNew className="w-4 h-4" />
                    Open PDF
                  </button>
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {viewerDocument && (
        <DocumentViewer
          documentUrl={viewerDocument.url}
          documentName={viewerDocument.name}
          isOpen={true}
          onClose={() => setViewerDocument(null)}
          onDownload={async () => {
            if (!selected?.id) return;
            try {
              await invoiceApi.exportPDF(selected.id, false);
            } catch (error: any) {
              toast.error(error.message || "Download failed");
            }
          }}
        />
      )}
    </div>
  );
}
