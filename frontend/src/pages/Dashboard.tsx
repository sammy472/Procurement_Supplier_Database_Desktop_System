import { useQuery } from "@tanstack/react-query";
import { useThemeStore } from "../store/themeStore";
import { apiClient, handleApiError } from "../api/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MdTrendingUp, MdShowChart, MdBusiness, MdDescription, MdNotes, MdShoppingCart, MdEmojiEvents, MdInbox } from "react-icons/md";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function Dashboard() {
  const isDark = useThemeStore((state) => state.isDark);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/dashboard/stats");
        return response.data;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },
  });

  if (isLoading) {
    return (
      <LoadingSkeleton />
    );
  }

  const statCards = [
    {
      title: "Total Suppliers",
      value: stats?.stats?.totalSuppliers || 0,
      icon: MdBusiness,
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Quotations This Month",
      value: stats?.stats?.quotationsThisMonth || 0,
      icon: MdDescription,
      gradient: "from-emerald-500 to-emerald-600",
    },
    {
      title: "Active Requests",
      value: stats?.stats?.activeRequests || 0,
      icon: MdNotes,
      gradient: "from-amber-500 to-amber-600",
    },
    {
      title: "Open Purchase Orders",
      value: stats?.stats?.openPOs || 0,
      icon: MdShoppingCart,
      gradient: "from-violet-500 to-violet-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Welcome back! Here's an overview of your procurement system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="card group hover:scale-105 transform"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    {card.title}
                  </p>
                  <p className={`text-3xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                    {card.value}
                  </p>
                </div>
                <div className={`text-4xl bg-gradient-to-br ${card.gradient} rounded-se-md rounded-es-md p-3 shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#3f51b5]">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Updated just now
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">RFQs</h2>
            <MdDescription className="w-7 h-7 text-primary-600" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.stats?.rfqs?.total || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.stats?.rfqs?.active || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Sent</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.stats?.rfqs?.sent || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Closed</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.stats?.rfqs?.closed || 0}</p>
            </div>
          </div>
          <div className="mt-6">
            {stats?.rfqTrend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={stats.rfqTrend}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#3f51b5" : "#e5e7eb"}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke={isDark ? "#9ca3af" : "#6b7280"}
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis
                    stroke={isDark ? "#9ca3af" : "#6b7280"}
                    style={{ fontSize: "12px" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#132f4c" : "#ffffff",
                      border: `1px solid ${isDark ? "#3f51b5" : "#e5e7eb"}`,
                      borderRadius: "8px",
                      color: isDark ? "#e5e7eb" : "#1f2937",
                    }}
                    cursor={{ fill: isDark ? "#3f51b5/20" : "#3b82f6/10" }}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: "10px",
                      color: isDark ? "#d1d5db" : "#374151",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#22d3ee"
                    radius={[8, 8, 0, 0]}
                    animationDuration={800}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MdShowChart className="w-10 h-10 mx-auto mb-2 text-primary-600" />
                <p className="text-gray-500 dark:text-gray-400">
                  No RFQ data available yet
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tenders</h2>
            <MdEmojiEvents className="w-7 h-7 text-yellow-500" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.stats?.tenders?.total || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Draft</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.stats?.tenders?.draft || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.stats?.tenders?.active || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Closed</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.stats?.tenders?.closed || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Cancelled</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.stats?.tenders?.cancelled || 0}</p>
            </div>
          </div>
          <div className="mt-6">
            {stats?.tenderTrend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={stats.tenderTrend}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#3f51b5" : "#e5e7eb"}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke={isDark ? "#9ca3af" : "#6b7280"}
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis
                    stroke={isDark ? "#9ca3af" : "#6b7280"}
                    style={{ fontSize: "12px" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#132f4c" : "#ffffff",
                      border: `1px solid ${isDark ? "#3f51b5" : "#e5e7eb"}`,
                      borderRadius: "8px",
                      color: isDark ? "#e5e7eb" : "#1f2937",
                    }}
                    cursor={{ fill: isDark ? "#3f51b5/20" : "#3b82f6/10" }}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: "10px",
                      color: isDark ? "#d1d5db" : "#374151",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#f472b6"
                    radius={[8, 8, 0, 0]}
                    animationDuration={800}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MdShowChart className="w-10 h-10 mx-auto mb-2 text-primary-600" />
                <p className="text-gray-500 dark:text-gray-400">
                  No tender data available yet
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts & Data */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Suppliers */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Top Suppliers
            </h2>
            <MdEmojiEvents className="w-7 h-7 text-yellow-500" />
          </div>

          <div className="space-y-3">
            {stats?.topSuppliers?.length > 0 ? (
              stats.topSuppliers.map((supplier: any, index: number) => (
                <div
                  key={supplier.id || index}
                  className="group flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-transparent dark:from-[#0f1929] dark:to-transparent hover:from-primary-50 dark:hover:from-primary-500/10 rounded-se-md rounded-es-md transition-all duration-200 border border-transparent hover:border-primary-200 dark:hover:border-primary-500/30"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {supplier.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {supplier.category || "General Supplier"}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-gray-900 dark:text-white">
                      {supplier.orderCount || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      orders
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MdInbox className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">
                  No supplier data available yet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quotation Trend Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Quotation Trend
            </h2>
            <MdTrendingUp className="w-7 h-7 text-primary-600" />
          </div>

          {stats?.quotationTrend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={stats.quotationTrend}
                margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#3f51b5" : "#e5e7eb"}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke={isDark ? "#9ca3af" : "#6b7280"}
                  style={{ fontSize: "12px" }}
                />
                <YAxis
                  stroke={isDark ? "#9ca3af" : "#6b7280"}
                  style={{ fontSize: "12px" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#132f4c" : "#ffffff",
                    border: `1px solid ${isDark ? "#3f51b5" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    color: isDark ? "#e5e7eb" : "#1f2937",
                  }}
                  cursor={{ fill: isDark ? "#3f51b5/20" : "#3b82f6/10" }}
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: "20px",
                    color: isDark ? "#d1d5db" : "#374151",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#0ea5e9"
                  radius={[8, 8, 0, 0]}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MdShowChart className="w-10 h-10 mx-auto mb-2 text-primary-600" />
              <p className="text-gray-500 dark:text-gray-400">
                No quotation data available yet
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
