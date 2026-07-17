import { useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, Animated, Dimensions, StyleSheet,
} from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getToken, clearAuth } from "../lib/storage";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.75;

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  MdDashboard: "grid-outline",
  MdSearch: "search-outline",
  MdAssignment: "document-text-outline",
  MdToll: "cash-outline",
  MdPayments: "card-outline",
  MdMail: "mail-outline",
  MdAccountCircle: "person-circle-outline",
  MdSettings: "settings-outline",
  MdTask: "checkmark-circle-outline",
  MdRateReview: "star-outline",
  MdReceiptLong: "receipt-outline",
  MdGroup: "people-outline",
  MdTaskAlt: "checkbox-outline",
  MdAssignmentTurnedIn: "clipboard-outline",
  MdAccountBalance: "business-outline",
  MdAnalytics: "bar-chart-outline",
  MdCategory: "layers-outline",
};

interface NavItem {
  label: string;
  icon: string;
  href: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  navItems: readonly NavItem[];
  userName?: string;
  userRole?: string;
}

export default function Sidebar({ open, onClose, navItems, userName, userRole }: Props) {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: open ? 0 : -SIDEBAR_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: open ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open]);

  function handleNav(href: string) {
    onClose();
    router.push(href as any);
  }

  async function handleLogout() {
    onClose();
    await clearAuth();
    router.replace("/(public)");
  }

  const isActive = (href: string) => {
    const normalizedPath = pathname.replace(/\/+$/, "");
    const normalizedHref = href.replace(/\/+$/, "");
    return normalizedPath === normalizedHref;
  };

  return (
    <>
      <Animated.View
        style={[styles.overlay, { opacity: overlayAnim }]}
        pointerEvents={open ? "auto" : "none"}
      >
        <TouchableOpacity style={styles.overlayTouch} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}
        pointerEvents={open ? "auto" : "none"}
      >
        <View style={styles.sidebarInner}>
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {userName || "User"}
            </Text>
            <Text style={styles.userRole}>{userRole || "Member"}</Text>
          </View>

          <View style={styles.navSection}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.href}
                style={[styles.navItem, isActive(item.href) && styles.navItemActive]}
                onPress={() => handleNav(item.href)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={ICON_MAP[item.icon] || "ellipse-outline"}
                  size={22}
                  color={isActive(item.href) ? "#FFFFFF" : "rgba(255,255,255,0.7)"}
                />
                <Text
                  style={[styles.navLabel, isActive(item.href) && styles.navLabelActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.logoutSection}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.7)" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 50,
  },
  overlayTouch: {
    flex: 1,
  },
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: "#004030",
    zIndex: 60,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  sidebarInner: {
    flex: 1,
    paddingTop: 60,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  userRole: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  navSection: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  navLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    flex: 1,
  },
  navLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  logoutSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
});
