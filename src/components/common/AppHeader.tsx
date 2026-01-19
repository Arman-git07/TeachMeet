
'use client'; // Explicitly mark as client component
import { PanelLeftOpen, Search } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import Link from 'next/link';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserProfileDropdown } from './UserProfileDropdown';

type AppHeaderProps = {
  showLogo?: boolean;
};

export function AppHeader({ showLogo = false }: AppHeaderProps) {
  const handleContactSearchClick = async () => {
    if ('contacts' in navigator && 'select' in (navigator as any).contacts) {
      try {
        const properties = ['name', 'email', 'tel'];
        const opts = { multiple: false };

        const contacts = await (navigator as any).contacts.select(properties, opts);

        if (contacts && contacts.length > 0) {
          const contact = contacts[0];
          let contactInfo = 'Selected contact:';
          if (contact.name && contact.name.length > 0) {
            contactInfo += `\nName: ${contact.name.join(', ')}`;
          }
          if (contact.email && contact.email.length > 0) {
            contactInfo += `\nEmail: ${contact.email.join(', ')}`;
          }
          if (contact.tel && contact.tel.length > 0) {
            contactInfo += `\nPhone: ${contact.tel.join(', ')}`;
          }
          alert(contactInfo);
          console.log('Selected contacts:', contacts);
        } else {
          alert('No contact selected.');
        }
      } catch (ex: any) {
        console.error('Error selecting contact:', ex);
        if (ex.message && ex.message.toLowerCase().includes("top frame")) {
          alert('Could not open contact picker. This feature might not work in embedded windows (like some development previews) and requires the app to be in the top browser window.');
        } else if (ex.name === 'InvalidStateError' && ex.message.toLowerCase().includes("user activation is required")) {
          alert('Could not open contact picker. Please try clicking the button again. This feature requires a direct user interaction.');
        }
         else {
          alert('Could not open contact picker. This feature might not be fully supported by your browser, or an error occurred.');
        }
      }
    } else {
      alert("The Contact Picker API is not supported by your browser. This feature allows you to select contacts from your device's address book. It's currently best supported on Chrome for Android.");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <SidebarTrigger className="md:hidden">
            <PanelLeftOpen className="h-6 w-6" />
          </SidebarTrigger>
          {showLogo && (
            <Link href="/" legacyBehavior>
              <a>
                <Logo size="small" />
              </a>
            </Link>
          )}
        </div>

        <div className="flex flex-1 items-center justify-center px-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <button
              onClick={handleContactSearchClick}
              className="w-full rounded-full bg-accent/10 pl-10 pr-4 py-2 text-sm text-left text-muted-foreground/80 hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent transition-colors h-[calc(2rem+4px)] flex items-center"
              aria-label="Search contact"
            >
              Search contact
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <UserProfileDropdown />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
