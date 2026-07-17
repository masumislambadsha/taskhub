import { View, Text, StyleSheet } from "react-native";

interface Props {
  title: string;
  message?: string;
  icon?: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: 'rgba(0,64,48,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 24,
    color: 'rgba(0,64,48,0.4)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#004030',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default function EmptyState({ title, message }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Text style={styles.icon}>!</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}
