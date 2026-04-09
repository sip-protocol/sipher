import type { Tool } from '@mariozechner/pi-ai'
import { readMentionsTool, executeReadMentions, type ReadMentionsParams } from './tools/read-mentions.js'
import { readDMsTool, executeReadDMs, type ReadDMsParams } from './tools/read-dms.js'
import { searchPostsTool, executeSearchPosts, type SearchPostsParams } from './tools/search-posts.js'
import { readUserProfileTool, executeReadUserProfile, type ReadUserProfileParams } from './tools/read-user.js'
import { postTweetTool, executePostTweet, type PostTweetParams } from './tools/post-tweet.js'
import { replyTweetTool, executeReplyTweet, type ReplyTweetParams } from './tools/reply-tweet.js'
import { likeTweetTool, executeLikeTweet, type LikeTweetParams } from './tools/like-tweet.js'
import { sendDMTool, executeSendDM, type SendDMParams } from './tools/send-dm.js'
import { schedulePostTool, executeSchedulePost, type SchedulePostParams } from './tools/schedule-post.js'

export const HERALD_SYSTEM_PROMPT = `You are HERALD — SIP Protocol's content and engagement agent on X/Twitter.

IDENTITY: Confident, technical, cypherpunk. Never corporate, never aggressive shilling. You speak for @SipProtocol.

RULES:
- Public replies NEVER echo wallet addresses, amounts, or private keys
- DMs can include wallet-specific info (private channel)
- Posts go through approval queue (not posted immediately) — use postTweet
- Thread context: last 5 tweets only, no cross-thread memory
- Keep replies concise — 1-2 sentences max

INTENT HANDLING:
- command → execute privacy tool or generate execution link
- question → helpful reply about SIP Protocol, stealth addresses, privacy
- engagement → like, RT, or short appreciative reply
- spam → ignore silently

TOOLS: readMentions, readDMs, searchPosts, readUserProfile, postTweet, replyTweet, likeTweet, sendDM, schedulePost`

export const HERALD_TOOLS: Tool[] = [
  readMentionsTool,
  readDMsTool,
  searchPostsTool,
  readUserProfileTool,
  postTweetTool,
  replyTweetTool,
  likeTweetTool,
  sendDMTool,
  schedulePostTool,
]

type ToolExecutor = (params: Record<string, unknown>) => Promise<unknown>

export const HERALD_TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  readMentions: (p) => executeReadMentions(p as unknown as ReadMentionsParams),
  readDMs: (p) => executeReadDMs(p as unknown as ReadDMsParams),
  searchPosts: (p) => executeSearchPosts(p as unknown as SearchPostsParams),
  readUserProfile: (p) => executeReadUserProfile(p as unknown as ReadUserProfileParams),
  postTweet: (p) => executePostTweet(p as unknown as PostTweetParams),
  replyTweet: (p) => executeReplyTweet(p as unknown as ReplyTweetParams),
  likeTweet: (p) => executeLikeTweet(p as unknown as LikeTweetParams),
  sendDM: (p) => executeSendDM(p as unknown as SendDMParams),
  schedulePost: (p) => executeSchedulePost(p as unknown as SchedulePostParams),
}

export const HERALD_IDENTITY = {
  name: 'HERALD',
  role: 'Content Agent',
  llm: true,
  model: 'anthropic/claude-sonnet-4.6',
} as const
