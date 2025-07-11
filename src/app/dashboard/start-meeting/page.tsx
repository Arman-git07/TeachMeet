
import { redirect } from 'next/navigation';

// This page is deprecated as the "Start New Meeting" functionality
// has been moved into a dialog accessible from the homepage and sidebar.
// This component redirects users to the homepage.
export default function DeprecatedStartMeetingPage() {
  redirect('/');
}
