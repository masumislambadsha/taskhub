import { View, TextInput, Text, TextInputProps, StyleSheet } from "react-native";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#004030',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.2)',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#004030',
    backgroundColor: '#FFF9E5',
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});

export default function Input({ label, error, ...props }: Props) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        placeholderTextColor="rgba(0,64,48,0.6)"
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
