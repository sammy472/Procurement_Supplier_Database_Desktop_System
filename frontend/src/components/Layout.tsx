import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { authApi } from "../api/auth";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "../api/notifications";
import { Notifications } from "./Notifications";
import antSavyLogo from "./../../assets/ant_savy.png";
import onkLogo from "./../../assets/onk.png";
import {
  MdDashboard,
  MdBusiness,
  MdInventory2,
  MdDescription,
  MdShoppingCart,
  MdNotes,
  MdWbSunny,
  MdNightlightRound,
  MdNotifications,
  MdAssignment,
  MdRequestQuote,
  MdRefresh,
  MdMenu,
  MdClose,
} from "react-icons/md";

export default function Layout() {
  const { user, logout: logoutStore } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logoutStore();
      navigate("/login");
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      logoutStore();
      navigate("/login");
    }
  };

  const navigation = [
    { name: "Dashboard", path: "/", icon: MdDashboard },
    { name: "Suppliers", path: "/suppliers", icon: MdBusiness },
    { name: "Materials", path: "/materials", icon: MdInventory2 },
    { name: "Quotations", path: "/quotations", icon: MdDescription },
    { name: "Purchase Orders", path: "/purchase-orders", icon: MdShoppingCart },
    { name: "Material Requests", path: "/material-requests", icon: MdNotes },
    { name: "Tenders", path: "/tenders", icon: MdAssignment },
    { name: "RFQs", path: "/rfqs", icon: MdRequestQuote },
  ];

  const isActive = (path: string) => location.pathname === path;

  const isAntSavy = user?.company === "ANT_SAVY";

  useEffect(() => {
    if (isAntSavy) {
      document.documentElement.classList.add("theme-antsavy");
      document.documentElement.classList.remove("theme-onkgroup");
    } else {
      document.documentElement.classList.remove("theme-antsavy");
      document.documentElement.classList.add("theme-onkgroup");
    }
  }, [isAntSavy]);

  return (
    <div className="min-h-screen bg-[var(--light-bg)] dark:bg-[var(--dark-bg)] app-wallpaper transition-colors duration-300 flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[var(--light-surface)] dark:bg-[var(--dark-surface)] border-b border-gray-200 dark:border-[var(--dark-border)] shadow-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <img
                src={isAntSavy ? antSavyLogo : onkLogo}
                alt={isAntSavy ? "Ant Savy" : "ONK Group"}
                className="h-8 w-auto select-none"
                draggable={false}
              />
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-se-md rounded-es-md text-sm font-medium transition-all duration-200 flex items-center space-x-1 ${
                      isActive(item.path)
                        ? (isDark
                            ? "dark:bg-[var(--dark-border)] dark:text-white"
                            : (isAntSavy
                                ? "bg-primary-100 text-gray-900"
                                : "bg-white/20 text-white"))
                        : (isDark
                            ? "dark:text-gray-200 dark:hover:text-white dark:hover:bg-[var(--dark-border)]"
                            : (isAntSavy
                                ? "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                                : "text-white/90 hover:text-white hover:bg-white/10"))
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-4">
              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-full bg-gray-100 dark:bg-[var(--dark-border)] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[var(--dark-border)] transition-all duration-200 md:hidden"
                title="Menu"
              >
                <MdMenu className="w-5 h-5" />
              </button>
              {/* Notifications */}
              <button
                onClick={() => setShowNotifications(true)}
                className="relative p-2 rounded-full bg-gray-100 dark:bg-[var(--dark-border)] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[var(--dark-border)] transition-all duration-200"
                title="Notifications"
              >
                <MdNotifications className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Refresh */}
              <button
                onClick={() => window.location.reload()}
                className="p-2 rounded-full bg-gray-100 dark:bg-[var(--dark-border)] text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-all duration-200"
                title="Refresh"
              >
                <MdRefresh className="w-5 h-5" />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-gray-100 dark:bg-[var(--dark-border)] text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-all duration-200"
                title={isDark ? "Light mode" : "Dark mode"}
              >
                {isDark ? <MdWbSunny className="w-5 h-5" /> : <MdNightlightRound className="w-5 h-5" />}
              </button>

              {/* User Info */}
              <div className="hidden sm:flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {user?.role.replace("_", " ")}
                  </p>
                </div>
                <Link
                  to="/profile"
                  title="View Profile"
                  className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-se-md rounded-es-md flex items-center justify-center text-white font-bold text-sm hover:shadow-lg transition-all duration-200"
                >
                  {user?.firstName.charAt(0)}{user?.lastName.charAt(0)}
                </Link>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className={`px-3 py-2 text-sm font-medium rounded-full transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-500/10 ${
                  !isAntSavy && !isDark
                    ? "text-white/90 hover:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                }`}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 md:hidden">
          <div className="absolute top-0 left-0 w-64 h-full bg-white dark:bg-[var(--dark-surface)] shadow-xl">
            <div className="flex items-center justify-between p-4 border-b dark:border-[var(--dark-border)]">
              <div className="flex items-center space-x-3">
                <img
                  src={isAntSavy ? antSavyLogo : onkLogo}
                  alt={isAntSavy ? "Ant Savy" : "ONK Group"}
                  className="h-6 w-auto select-none"
                  draggable={false}
                />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Menu</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[var(--dark-border)]"
                title="Close"
              >
                <MdClose className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
            <div className="p-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm ${
                      active
                        ? "bg-primary-100 dark:bg-[var(--dark-border)] text-primary-700 dark:text-primary-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[var(--dark-border)]"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Grows to fill space */}
      <main className="flex-grow max-w-7xl mx-auto w-full py-8 sm:px-6 lg:px-8 px-4">
        <div className="animate-fadeIn">
          <Outlet />
        </div>
      </main>

      {/* Fixed Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-[var(--dark-border)] bg-[var(--light-surface)] dark:bg-[var(--dark-surface)] py-4 shadow-lg dark:shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            <span className={`${!isAntSavy && !isDark ? "text-white/90" : ""} inline-flex items-center justify-center gap-2`}>
              <img
                src={isAntSavy ? antSavyLogo : onkLogo}
                alt={isAntSavy ? "Ant Savy" : "ONK Group"}
                className="h-5 w-auto inline-block align-middle select-none"
                draggable={false}
              />
              © {new Date().getFullYear()} Procurement Management System. All rights reserved.
            </span>
          </p>
        </div>
      </footer>

      {/* Spacer for fixed footer */}
      <div className="h-16"></div>

      {/* Notifications Modal */}
      <Notifications
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
}
