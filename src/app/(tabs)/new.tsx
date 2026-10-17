import { Redirect } from 'expo-router';

// Placeholder route behind the centre "+" tab button, which opens /hand/new.
export default function NewTab() {
  return <Redirect href="/hand/new" />;
}
