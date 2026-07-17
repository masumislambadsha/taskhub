import { View, TextInput, Text, StyleSheet, TextInputProps } from "react-native";
import { COLORS } from "../../lib/constants";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export default function Input({ label, error, style, ...props }: Props) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={`${COLORS.textSecondary}99`}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "500", color: COLORS.text, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#00403033",
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  error: { fontSize: 12, color: COLORS.danger, marginTop: 4 },
});
