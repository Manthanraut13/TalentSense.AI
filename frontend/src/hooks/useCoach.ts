import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { sendCoachMessage } from '../lib/api';

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function useCoach() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm your AI career coach. I can see your analysis history and help you figure out your next moves. What's on your mind?",
      timestamp: new Date(),
    },
  ]);

  const mutation = useMutation({
    mutationFn: (message: string) => sendCoachMessage({ message, conversationId }),
    onMutate: (message) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: message, timestamp: new Date() },
      ]);
    },
    onSuccess: (data) => {
      setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, timestamp: new Date() },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm having trouble responding right now. Please try again.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  return {
    messages,
    sendMessage: mutation.mutate,
    isLoading: mutation.isPending,
    conversationId,
  };
}
