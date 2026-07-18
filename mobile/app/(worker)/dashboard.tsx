import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import api from "../../src/lib/api";
import { getUserData } from "../../src/lib/storage";
import Card from "../../src/components/ui/Card";
import Button from "../../src/components/ui/Button";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import FadeInView from "../../src/components/animations/FadeInView";
import SlideInView from "../../src/components/animations/SlideInView";
import StaggerContainer from "../../src/components/animations/StaggerContainer";
import ScaleOnPress from "../../src/components/animations/ScaleOnPress";
import AnimatedCard from "../../src/components/animations/AnimatedCard";
import AnimatedNumber from "../../src/components/animations/AnimatedNumber";
import type { ISubmission } from "../../src/types";
import type { PaginatedResponse } from "../../src/types";

export default function Dashboard() {
  const [firstName, setFirstName] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadUser = useCallback(async () => {
    const str = await getUserData();
    if (str) {
      try {
        const u = JSON.parse(str);
        setFirstName(u.name?.split(" ")[0] || u.name || "");
      } catch {}
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [])
  );

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const submissionsQuery = useQuery({
    queryKey: ["worker-dashboard-submissions"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ISubmission, 'submissions'>>("/api/v1/submissions", { params: { page: 1, limit: 100 } });
      return data;
    },
  });

  const meQuery = useQuery({
    queryKey: ["worker-dashboard-me"],
    queryFn: async () => {
      const { data } = await api.get<{ data: { coins: number } }>("/api/v1/auth/me");
      return data.data;
    },
  });

  const submissions = submissionsQuery.data?.submissions ?? [];
  const totalSubmissions = submissions.length;
  const approved = submissions.filter((s) => s.status === "approved").length;
  const pending = submissions.filter((s) => s.status === "pending").length;
  const coins = meQuery.data?.coins ?? 0;

  const recentSubmissions = submissions.slice(-6).reverse();

  const approvalRate = totalSubmissions > 0 ? Math.round((approved / totalSubmissions) * 100) : 0;

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([submissionsQuery.refetch(), meQuery.refetch()]);
    await loadUser();
    setRefreshing(false);
  }, []);

  const isLoading = submissionsQuery.isLoading || meQuery.isLoading;
  const isError = submissionsQuery.isError || meQuery.isError;
  const isEmpty = !isLoading && !isError && totalSubmissions === 0;

  if (isLoading) return <Spinner message="Loading dashboard..." />;

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
    >
      <FadeInView>
        <View style={styles.greetingSection}>
          <View>
            <Text style={styles.greeting}>Welcome back, {firstName}</Text>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={100}>
        <ScaleOnPress>
          <Button
            title="Browse Tasks"
            onPress={() => router.push("/(worker)/tasks")}
            style={styles.browseButton}
          />
        </ScaleOnPress>
      </FadeInView>

      <StaggerContainer staggerDelay={80} direction="up">
        <View style={styles.statsGrid}>
          <AnimatedCard style={styles.statCard} interactive>
            <View style={styles.statCardInner}>
              <Ionicons name="document-text-outline" size={24} color="#004030" />
              <AnimatedNumber value={totalSubmissions} style={styles.statValue} />
              <Text style={styles.statLabel}>Total Submissions</Text>
            </View>
          </AnimatedCard>
          <AnimatedCard style={styles.statCard} interactive>
            <View style={styles.statCardInner}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#4A9782" />
              <AnimatedNumber value={approved} style={styles.statValue} />
              <Text style={styles.statLabel}>Approved</Text>
            </View>
          </AnimatedCard>
          <AnimatedCard style={styles.statCard} interactive>
            <View style={styles.statCardInner}>
              <Ionicons name="time-outline" size={24} color="#F59E0B" />
              <AnimatedNumber value={pending} style={styles.statValue} />
              <Text style={styles.statLabel}>Pending Review</Text>
            </View>
          </AnimatedCard>
          <AnimatedCard variant="accent" style={styles.statCard} interactive>
            <View style={styles.statCardInner}>
              <Ionicons name="cash-outline" size={24} color="#FFFFFF" />
              <AnimatedNumber value={coins} style={styles.statValueWhite} />
              <Text style={styles.statLabelWhite}>Available Coins</Text>
            </View>
          </AnimatedCard>
        </View>
      </StaggerContainer>

      <SlideInView delay={200} direction="up">
        <View style={styles.chartsRow}>
          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Earnings This Week</Text>
            <View style={styles.chartBars}>
              {[40, 65, 30, 80, 55, 90, 45].map((h, i) => (
                <Bar key={i} height={h} index={i} />
              ))}
            </View>
            <Text style={styles.chartDayLabels}>Mon Tue Wed Thu Fri Sat Sun</Text>
          </Card>
          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Performance</Text>
            <View style={styles.performanceRow}>
              <View style={styles.performanceBar}>
                <View style={[styles.performanceFill, { width: `${approvalRate}%` }]} />
              </View>
              <AnimatedNumber value={approvalRate} suffix="%" style={styles.performancePct} />
            </View>
            <Text style={styles.performanceLabel}>Approval Rate</Text>
          </Card>
        </View>
      </SlideInView>

      <SlideInView delay={300} direction="up">
        <Text style={styles.sectionTitle}>Recent Submissions</Text>
        {recentSubmissions.length > 0 ? (
          <StaggerContainer staggerDelay={60} direction="up">
            {recentSubmissions.map((s) => (
              <AnimatedCard key={s._id} style={styles.submissionCard}>
                <View style={styles.submissionRow}>
                  <Text style={styles.submissionTitle} numberOfLines={1}>{s.taskTitle}</Text>
                  <Badge label={s.status} variant={s.status as "pending" | "approved" | "rejected"} />
                </View>
                <Text style={styles.submissionDate}>{new Date(s.createdAt).toLocaleDateString()}</Text>
              </AnimatedCard>
            ))}
          </StaggerContainer>
        ) : (
          <EmptyState title="No submissions yet" message="Submit work on tasks to see them here" />
        )}
      </SlideInView>

      <SlideInView delay={400} direction="up">
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <ScaleOnPress>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(worker)/tasks")} activeOpacity={1}>
              <Ionicons name="search-outline" size={28} color="#004030" />
              <Text style={styles.actionLabel}>Browse Tasks</Text>
            </TouchableOpacity>
          </ScaleOnPress>
          <ScaleOnPress>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(worker)/submissions")} activeOpacity={1}>
              <Ionicons name="document-text-outline" size={28} color="#4A9782" />
              <Text style={styles.actionLabel}>Submissions</Text>
            </TouchableOpacity>
          </ScaleOnPress>
          <ScaleOnPress>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(worker)/earnings")} activeOpacity={1}>
              <Ionicons name="cash-outline" size={28} color="#F59E0B" />
              <Text style={styles.actionLabel}>Earnings</Text>
            </TouchableOpacity>
          </ScaleOnPress>
          <ScaleOnPress>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(worker)/withdrawals")} activeOpacity={1}>
              <Ionicons name="card-outline" size={28} color="#EF4444" />
              <Text style={styles.actionLabel}>Withdraw</Text>
            </TouchableOpacity>
          </ScaleOnPress>
        </View>
      </SlideInView>
    </ScrollView>
  );
}

const AnimatedView = Animated.createAnimatedComponent(View);

function Bar({ height, index }: { height: number; index: number }) {
  const animatedHeight = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  useEffect(() => {
    const timer = setTimeout(() => {
      animatedHeight.value = withSpring(height, { damping: 15, stiffness: 100 });
    }, index * 60);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.barItem}>
      <AnimatedView style={[styles.bar, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9E5',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(0,64,48,0.6)',
    textAlign: 'center',
  },
  retryText: {
    fontSize: 16,
    color: '#004030',
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  greetingSection: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#004030',
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
  browseButton: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    paddingVertical: 0,
  },
  statCardInner: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#004030',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  statValueWhite: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabelWhite: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  chartsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  chartCard: {
    flex: 1,
    paddingVertical: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 12,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  barItem: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 8,
    borderRadius: 8,
    backgroundColor: '#004030',
    minHeight: 4,
  },
  chartDayLabels: {
    fontSize: 10,
    color: 'rgba(0,64,48,0.6)',
    textAlign: 'center',
    marginTop: 6,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  performanceBar: {
    flex: 1,
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,64,48,0.1)',
  },
  performanceFill: {
    height: 12,
    borderRadius: 8,
    backgroundColor: '#004030',
  },
  performancePct: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
  },
  performanceLabel: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 12,
  },
  submissionCard: {
    marginBottom: 8,
  },
  submissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submissionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00281D',
    flex: 1,
    marginRight: 8,
  },
  submissionDate: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
    padding: 20,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00281D',
    marginTop: 8,
  },
});
