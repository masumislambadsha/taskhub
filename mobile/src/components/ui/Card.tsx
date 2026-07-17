import { View, ViewStyle, StyleSheet } from "react-native";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: "default" | "accent" | "auth" | "feature";
}

const styles = StyleSheet.create({
  default: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  accent: {
    backgroundColor: '#004030',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#004030',
    padding: 16,
  },
  auth: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  feature: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
    padding: 20,
  },
});

export default function Card({ children, style, variant = "default" }: Props) {
  return <View style={[styles[variant], style]}>{children}</View>;
}
