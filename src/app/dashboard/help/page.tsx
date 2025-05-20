import { HelpChat } from '@/components/help/HelpChat';

export default function HelpPage() {
  return (
    <div className="container mx-auto py-8 flex flex-col items-center">
      <div className="w-full max-w-3xl mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">How can we help?</h1>
        <p className="text-muted-foreground">
          Ask our AI Assistant any questions you have about using TeachMeet.
          Just type your query in the chat window below.
        </p>
      </div>
      {/* The HelpChat component itself contains the question asking textbox */}
      <HelpChat />
    </div>
  );
}
