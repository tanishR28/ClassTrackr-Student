import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { initDatabase } from "../services/database";

export default function Layout() {
  return (
    <SQLiteProvider databaseName="classtrackr.db" onInit={initDatabase}>
      <Stack screenOptions={{ headerShown: false }} />
    </SQLiteProvider>
  );
}
