import { Alert, Platform } from "react-native";

// Cross-platform alert that works on Web, iOS, and Android
export const showAlert = (title, message, buttons = [{ text: "OK" }]) => {
  if (Platform.OS === "web") {
    // For web, use browser's alert/confirm
    if (buttons.length === 1) {
      // Simple alert
      window.alert(`${title}\n\n${message}`);
      if (buttons[0].onPress) {
        buttons[0].onPress();
      }
    } else {
      // Confirm dialog for multiple buttons
      const result = window.confirm(`${title}\n\n${message}`);
      if (result && buttons[1]?.onPress) {
        buttons[1].onPress();
      } else if (!result && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    // For mobile (iOS/Android), use native Alert
    Alert.alert(title, message, buttons);
  }
};
