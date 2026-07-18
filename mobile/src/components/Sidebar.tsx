/* eslint-disable react-hooks/immutability */
import { useEffect } from "react";
import { View, Text, TouchableOpacity, Image, Dimensions, StyleSheet } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing, interpolate } from "react-native-reanimated";
import { clearAuth } from "../lib/storage";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 320);

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
  photoUrl?: string;
  coins?: number;
}

export default function Sidebar({ open, onClose, navItems, userName, userRole, photoUrl, coins }: Props) {
  const slideProgress = useSharedValue(0);
  const pathname = usePathname();

  useEffect(() => {
    slideProgress.value = withSpring(open ? 1 : 0, {
      damping: 20,
      stiffness: 150,
      mass: 0.8,
    });
  }, [open]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideProgress.value, [0, 1], [0, 0.4]),
    pointerEvents: slideProgress.value > 0.5 ? ("auto" as const) : ("none" as const),
  }));

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          slideProgress.value,
          [0, 1],
          [-SIDEBAR_WIDTH, 0],
        ),
      },
    ],
    pointerEvents: slideProgress.value > 0.5 ? ("auto" as const) : ("none" as const),
  }));

  function handleNav(href: string) {
    onClose();
    router.push(href as Parameters<typeof router.push>[0]);
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
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <TouchableOpacity style={styles.overlayTouch} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sidebar, sidebarStyle]}>
        <View style={styles.sidebarInner}>
          <View style={styles.profileSection}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {(userName?.[0] || "U").toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.userName} numberOfLines={1}>
              {userName || "User"}
            </Text>
            {coins !== undefined && (
              <View style={styles.coinRow}>
                <Ionicons name="cash-outline" size={14} color="#DCD0A8" />
                <Text style={styles.coinText}>{coins.toLocaleString()}</Text>
              </View>
            )}
            <Text style={styles.userRole}>{userRole || "Member"}</Text>
          </View>

          <View style={styles.navSection}>
            {navItems.map((item, index) => (
              <NavItemComponent
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                index={index}
                onPress={() => handleNav(item.href)}
              />
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

function NavItemComponent({ item, isActive, index, onPress }: { item: NavItem; isActive: boolean; index: number; onPress: () => void }) {
  const translateX = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.navItem, isActive && styles.navItemActive]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name={ICON_MAP[item.icon] || "ellipse-outline"}
          size={22}
          color={isActive ? "#FFFFFF" : "rgba(255,255,255,0.7)"}
        />
        <Text
          style={[styles.navLabel, isActive && styles.navLabelActive]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
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
    marginBottom: 8,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 8,
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  coinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  coinText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DCD0A8",
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
