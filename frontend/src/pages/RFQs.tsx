import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rfqsApi, Rfq, RfqItem, RfqStatus } from "../api/rfqs";
import { authApi } from "../api/auth";
import { toast } from "react-toastify";
import { useAuthStore } from "../store/authStore";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function RFQs() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [statusFilter, setStatusFilter] = useState<RfqStatus | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<any[]>([]);

  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ["rfqs", statusFilter],
    queryFn: () =>
      rfqsApi.getAll(
        statusFilter === "all" ? undefined : { status: statusFilter, limit: 50 }
      ),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const canAssign = user?.role === "admin" || user?.role === "procurement_officer";
  const { data: users = [] } = useQuery({
    queryKey: ["users-for-rfq"],
    queryFn: () => authApi.getUsers(),
    enabled: canAssign,
    staleTime: 300000,
    retry: 0,
  });

  const [createSubject, setCreateSubject] = useState("");
  const [createSenderAddress, setCreateSenderAddress] = useState("");
  const [createOpenDate, setCreateOpenDate] = useState<string>("");
  const [createCloseDate, setCreateCloseDate] = useState<string>("");
  const [createItems, setCreateItems] = useState<RfqItem[]>([
    { description: "", quantity: 1 },
  ]);
  const [createAssignees, setCreateAssignees] = useState<string[]>([]);
  const [newCreateItem, setNewCreateItem] = useState<RfqItem>({
    description: "",
    quantity: 1,
  });
  const [newEditItem, setNewEditItem] = useState<RfqItem>({
    description: "",
    quantity: 1,
  });

  useEffect(() => {
    if (!isCreateOpen) {
      setCreateSubject("");
      setCreateSenderAddress("");
      setCreateOpenDate("");
      setCreateCloseDate("");
      setCreateItems([{ description: "", quantity: 1 }]);
      setCreateAssignees([]);
    }
  }, [isCreateOpen]);

  const openView = async (rfq: Rfq) => {
    try {
      const res = await rfqsApi.getById(rfq.id);
      setSelectedRfq(res.rfq);
      setSelectedAssignments(res.assignments || []);
      setIsViewOpen(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openEdit = async (rfq: Rfq) => {
    try {
      const res = await rfqsApi.getById(rfq.id);
      setSelectedRfq(res.rfq);
      setSelectedAssignments(res.assignments || []);
      setIsEditOpen(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const removeCreateItem = (idx: number) => {
    setCreateItems((items) => items.filter((_, i) => i !== idx));
  };
  const handleAddCreateItem = () => {
    if (!newCreateItem.description) {
      toast.error("Description is required");
      return;
    }
    if (!newCreateItem.quantity || newCreateItem.quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    setCreateItems((items) => [...items, { ...newCreateItem }]);
    setNewCreateItem({ description: "", quantity: 1 });
  };

  const submitCreate = async () => {
    try {
      const validItems = createItems
        .map((it) => ({ ...it, quantity: Number(it.quantity) || 1 }))
        .filter((it) => it.description && it.quantity > 0);
      if (!createSubject || !createSenderAddress || !createOpenDate || !createCloseDate || validItems.length === 0) {
        toast.error("Fill all required fields");
        return;
      }
      await rfqsApi.create({
        subject: createSubject,
        senderAddress: createSenderAddress,
        items: validItems,
        openDate: new Date(createOpenDate).toISOString(),
        closeDate: new Date(createCloseDate).toISOString(),
        assigneeIds: canAssign ? createAssignees : undefined,
      });
      toast.success("RFQ created");
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const submitEdit = async () => {
    if (!selectedRfq) return;
    try {
      await rfqsApi.update(selectedRfq.id, {
        subject: selectedRfq.subject,
        senderAddress: selectedRfq.senderAddress,
        items: selectedRfq.items,
        openDate: selectedRfq.openDate,
        closeDate: selectedRfq.closeDate,
        status: selectedRfq.status,
        assigneeIds: canAssign ? selectedAssignments.map((a: any) => a.assigneeId) : undefined,
      });
      toast.success("RFQ updated");
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleResolved = async (rfq: Rfq, resolved: boolean) => {
    try {
      const updated = await rfqsApi.setResolved(rfq.id, resolved);
      toast.success("RFQ status updated");
      setSelectedRfq(updated);
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const statusColor = (s: RfqStatus) =>
    s === "active"
      ? "bg-yellow-100 text-yellow-800"
      : s === "sent"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-200 text-gray-800";

  const formatDate = (iso: string) => new Date(iso).toLocaleString();

  if (isLoading) {
    return (
      <LoadingSkeleton/>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">RFQs</h2>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="sent">Sent</option>
            <option value="closed">Closed</option>
          </select>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn w-48 h-7 btn-primary rounded-full"
          >
            New RFQ
          </button>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Sender</th>
              <th>Items</th>
              <th>Open</th>
              <th>Close</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rfqs.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => openView(r)}
              >
                <td className="truncate max-w-[240px]">{r.subject}</td>
                <td className="truncate max-w-[240px]">{r.senderAddress}</td>
                <td>{r.items.length}</td>
                <td>{formatDate(r.openDate)}</td>
                <td>{formatDate(r.closeDate)}</td>
                <td>
                  <span className={`px-2 py-1 text-xs rounded-md ${statusColor(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(r);
                      }}
                      className="text-primary-600 hover:text-primary-900 dark:text-primary-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const ok = window.confirm("Delete this RFQ?");
                          if (!ok) return;
                          await rfqsApi.delete(r.id);
                          toast.success("RFQ deleted");
                          queryClient.invalidateQueries({ queryKey: ["rfqs"] });
                        } catch (error: any) {
                          toast.error(error.message);
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-se-md rounded-es-md p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create RFQ</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                <input
                  type="text"
                  className="input"
                  value={createSubject}
                  onChange={(e) => setCreateSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sender's address</label>
                <textarea
                  className="input"
                  value={createSenderAddress}
                  onChange={(e) => setCreateSenderAddress(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">RFQ opening date</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={createOpenDate}
                    onChange={(e) => setCreateOpenDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Closing date</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={createCloseDate}
                    onChange={(e) => setCreateCloseDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Items</label>
                {createItems.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Part/Serial</th>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createItems.map((it, idx) => (
                          <tr key={idx}>
                            <td className="text-sm">
                              {[it.partNumber, it.serialNumber].filter(Boolean).join(" / ") || "—"}
                            </td>
                            <td className="text-sm">{it.description}</td>
                            <td className="text-sm">{it.quantity}</td>
                            <td className="text-center">
                              <button
                                onClick={() => removeCreateItem(idx)}
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
                      value={newCreateItem.description}
                      onChange={(e) =>
                        setNewCreateItem({ ...newCreateItem, description: e.target.value })
                      }
                      className="input"
                      rows={2}
                      placeholder="Item description"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Part number
                      </label>
                      <input
                        type="text"
                        value={newCreateItem.partNumber || ""}
                        onChange={(e) =>
                          setNewCreateItem({ ...newCreateItem, partNumber: e.target.value })
                        }
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Serial number
                      </label>
                      <input
                        type="text"
                        value={newCreateItem.serialNumber || ""}
                        onChange={(e) =>
                          setNewCreateItem({ ...newCreateItem, serialNumber: e.target.value })
                        }
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newCreateItem.quantity}
                        onChange={(e) =>
                          setNewCreateItem({
                            ...newCreateItem,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        className="input"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCreateItem}
                    className="w-full btn btn-primary rounded-full text-sm"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {canAssign && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assign members</label>
                  <div className="max-h-40 overflow-auto border rounded-md dark:border-[var(--dark-border)] p-2">
                    {users.map((u) => {
                      const id = u.id;
                      const checked = createAssignees.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2 text-sm py-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setCreateAssignees((prev) =>
                                e.target.checked ? [...prev, id] : prev.filter((x) => x !== id)
                              );
                            }}
                          />
                          <span>{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCreate}
                  className="btn btn-primary"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isViewOpen && selectedRfq && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-md p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">RFQ Details</h3>
              <button
                onClick={() => setIsViewOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Subject:</span>
                <p className="text-gray-900 dark:text-white">{selectedRfq.subject}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Sender's address:</span>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedRfq.senderAddress}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Opening date:</span>
                  <p className="text-gray-900 dark:text-white">{formatDate(selectedRfq.openDate)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Closing date:</span>
                  <p className="text-gray-900 dark:text-white">{formatDate(selectedRfq.closeDate)}</p>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status:</span>
                <p>
                  <span className={`px-2 py-1 text-xs rounded-md ${statusColor(selectedRfq.status)}`}>
                    {selectedRfq.status}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Assigned members:</span>
                <div className="mt-1 space-y-1">
                  {selectedAssignments.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">None</p>
                  ) : (
                    selectedAssignments.map((a) => (
                      <p key={a.assigneeId} className="text-sm text-gray-900 dark:text-white">
                        {[a.firstName, a.lastName].filter(Boolean).join(" ") || a.email || a.assigneeId}
                      </p>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Items</h4>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Part/Serial</th>
                        <th>Description</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRfq.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="text-sm">
                            {[it.partNumber, it.serialNumber].filter(Boolean).join(" / ") || "—"}
                          </td>
                          <td className="text-sm">{it.description}</td>
                          <td className="text-sm">{it.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedRfq.status !== "active"}
                  disabled={selectedRfq.status === "closed"}
                  onChange={(e) => toggleResolved(selectedRfq, e.target.checked)}
                />
                <span>Resolved?</span>
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsViewOpen(false);
                    if (selectedRfq) openEdit(selectedRfq);
                  }}
                  className="btn btn-primary"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!selectedRfq) return;
                    const ok = window.confirm("Delete this RFQ?");
                    if (!ok) return;
                    try {
                      await rfqsApi.delete(selectedRfq.id);
                      toast.success("RFQ deleted");
                      setIsViewOpen(false);
                      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
                    } catch (error: any) {
                      toast.error(error.message);
                    }
                  }}
                  className="btn bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </button>
                <button
                  onClick={() => setIsViewOpen(false)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && selectedRfq && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-se-md rounded-es-md p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit RFQ</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                <input
                  type="text"
                  className="input"
                  value={selectedRfq.subject}
                  onChange={(e) =>
                    setSelectedRfq({ ...selectedRfq, subject: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sender's address</label>
                <textarea
                  className="input"
                  value={selectedRfq.senderAddress}
                  onChange={(e) =>
                    setSelectedRfq({ ...selectedRfq, senderAddress: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">RFQ opening date</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={selectedRfq.openDate.slice(0, 16)}
                    onChange={(e) =>
                      setSelectedRfq({ ...selectedRfq, openDate: new Date(e.target.value).toISOString() })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Closing date</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={selectedRfq.closeDate.slice(0, 16)}
                    onChange={(e) =>
                      setSelectedRfq({ ...selectedRfq, closeDate: new Date(e.target.value).toISOString() })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Items</label>
                {selectedRfq.items.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Part/Serial</th>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRfq.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="text-sm">
                              {[it.partNumber, it.serialNumber].filter(Boolean).join(" / ") || "—"}
                            </td>
                            <td className="text-sm">{it.description}</td>
                            <td className="text-sm">{it.quantity}</td>
                            <td className="text-center">
                              <button
                                onClick={() => {
                                  const items = selectedRfq.items.filter((_, i) => i !== idx);
                                  setSelectedRfq({ ...selectedRfq, items });
                                }}
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
                      value={newEditItem.description}
                      onChange={(e) =>
                        setNewEditItem({ ...newEditItem, description: e.target.value })
                      }
                      className="input"
                      rows={2}
                      placeholder="Item description"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Part number
                      </label>
                      <input
                        type="text"
                        value={newEditItem.partNumber || ""}
                        onChange={(e) =>
                          setNewEditItem({ ...newEditItem, partNumber: e.target.value })
                        }
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Serial number
                      </label>
                      <input
                        type="text"
                        value={newEditItem.serialNumber || ""}
                        onChange={(e) =>
                          setNewEditItem({ ...newEditItem, serialNumber: e.target.value })
                        }
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newEditItem.quantity}
                        onChange={(e) =>
                          setNewEditItem({
                            ...newEditItem,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        className="input"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newEditItem.description) {
                        toast.error("Description is required");
                        return;
                      }
                      if (!newEditItem.quantity || newEditItem.quantity <= 0) {
                        toast.error("Quantity must be greater than 0");
                        return;
                      }
                      const items = [...selectedRfq.items, { ...newEditItem }];
                      setSelectedRfq({ ...selectedRfq, items });
                      setNewEditItem({ description: "", quantity: 1 });
                    }}
                    className="w-full btn btn-primary rounded-full text-sm"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {canAssign && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assigned members</label>
                  <div className="max-h-40 overflow-auto border rounded-md dark:border-[var(--dark-border)] p-2">
                    {users.map((u) => {
                      const id = u.id;
                      const checked = selectedAssignments.some((a: any) => a.assigneeId === id);
                      return (
                        <label key={id} className="flex items-center gap-2 text-sm py-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedAssignments((prev) => {
                                if (e.target.checked) {
                                  return [...prev, { assigneeId: id }];
                                }
                                return prev.filter((x: any) => x.assigneeId !== id);
                              });
                            }}
                          />
                          <span>{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEdit}
                  className="btn btn-primary"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
