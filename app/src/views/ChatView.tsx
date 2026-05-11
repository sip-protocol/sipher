import ChatSidebar from '../components/ChatSidebar'

export default function ChatView() {
  return (
    <div data-testid="chat-view" className="lg:hidden h-full">
      <title>SIPHER — Chat</title>
      <meta name="description" content="Ask SIPHER about your privacy posture." />
      <meta property="og:title" content="SIPHER — Chat" />
      <meta property="og:description" content="Ask SIPHER about your privacy posture." />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="/icons/sipher.svg" />
      <ChatSidebar fullScreen />
    </div>
  )
}
