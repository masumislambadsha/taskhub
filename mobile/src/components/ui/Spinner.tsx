import { ActivityIndicator, View, Text, StyleSheet } from "react-native";

interface Props {
  size?: "small" | "large";
  message?: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9E5',
    padding: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
});

export default function Spinner({ size = "large", message }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color="#004030" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}
