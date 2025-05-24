
// This page is no longer used as the "Start New Meeting" functionality
// has been moved into a dialog.
// You can delete this file if it's not referenced elsewhere.

// export default function StartMeetingPage() {
//   return (
//     <div>
//       <h1>This page has been replaced by a dialog.</h1>
//       <p>
//         The "Start New Meeting" functionality is now accessed via a pop-up
//         triggered from the sidebar or the main page&apos;s slide-up panel.
//       </p>
//     </div>
//   );
// }

// To prevent build errors if other parts of the code (e.g. tests, other links) still expect this route,
// we can provide a minimal component that redirects or explains.
// For now, let's just make it an empty component or a redirector if it's truly unused.
// If Next.js tries to render this, it will just be blank.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeprecatedStartMeetingPage() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to a more relevant page, e.g., the main page or dashboard overview
    // since the dedicated start meeting page is now a dialog.
    router.replace('/'); 
  }, [router]);

  return null; // Render nothing while redirecting
}
