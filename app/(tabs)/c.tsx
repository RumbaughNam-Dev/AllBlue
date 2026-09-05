import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';

export default function TabC() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>C</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brand.primary },
  title: { fontFamily: 'SUIT-Bold', fontSize: 24, color: Colors.brand.white },
});
