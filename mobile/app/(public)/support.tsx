import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/lib/constants";
import Card from "../../src/components/ui/Card";

export default function Support() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Support</Text>
        <Text style={styles.headerSubtitle}>We're here to help</Text>
      </View>

      <Card style={styles.supportCard}>
        <View style={styles.iconRow}>
          <Ionicons name="mail-outline" size={28} color={COLORS.primary} />
        </View>
        <Text style={styles.cardTitle}>Contact Us</Text>
        <Text style={styles.cardText}>
          Have a question or need assistance? Our support team is available to help you with any issues.
        </Text>
        <TouchableOpacity
          style={styles.emailRow}
          onPress={() => Linking.openURL("mailto:support@taskhub.com")}
          activeOpacity={0.7}
        >
          <Ionicons name="mail" size={18} color={COLORS.secondary} />
          <Text style={styles.emailText}>support@taskhub.com</Text>
        </TouchableOpacity>
      </Card>

      <Card style={styles.supportCard}>
        <Text style={styles.cardTitle}>Frequently Asked Questions</Text>

        <Text style={styles.faqQuestion}>How do I start earning?</Text>
        <Text style={styles.faqAnswer}>
          Sign up for a free account, complete your profile, and browse available tasks. Apply to tasks
          that match your skills and start earning coins once your work is approved.
        </Text>

        <Text style={styles.faqQuestion}>How do I withdraw my earnings?</Text>
        <Text style={styles.faqAnswer}>
          Once you've earned at least 200 coins, you can request a withdrawal. Coins are converted at a
          rate of 20 coins per $1 USD and sent to your preferred payment method.
        </Text>

        <Text style={styles.faqQuestion}>What happens if my submission is rejected?</Text>
        <Text style={styles.faqAnswer}>
          If your submission is rejected, you can revise and resubmit based on the buyer's feedback.
          Open communication with buyers helps ensure successful outcomes.
        </Text>

        <Text style={styles.faqQuestion}>How do I buy coins?</Text>
        <Text style={styles.faqAnswer}>
          Buyers can purchase coin packages from the Coins section. We accept multiple payment methods
          including credit cards and mobile wallets.
        </Text>
      </Card>

      <Card style={styles.supportCard}>
        <Text style={styles.cardTitle}>Still need help?</Text>
        <Text style={styles.cardText}>
          Our support team typically responds within 24 hours. For urgent matters, please reach out via
          email with "URGENT" in the subject line.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  headerBar: { marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  headerSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  supportCard: { marginBottom: 16 },
  iconRow: { alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  cardText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 12 },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  emailText: { fontSize: 15, color: COLORS.secondary, fontWeight: "600" },
  faqQuestion: { fontSize: 15, fontWeight: "600", color: COLORS.text, marginTop: 16, marginBottom: 4 },
  faqAnswer: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
});
