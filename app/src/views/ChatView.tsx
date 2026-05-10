import ChatSidebar from '../components/ChatSidebar'

export default function ChatView() {
  return (
    <div data-testid="chat-view" className="lg:hidden h-full">
      <ChatSidebar fullScreen />
    </div>
  )
}
