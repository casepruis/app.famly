import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { MessageSquare, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

export default function ConversationList({ conversations, activeConversationId }) {
    return (
        <div className="w-80 border-r bg-gray-50/50 flex flex-col">
            <div className="p-4 border-b">
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                    Chats
                </h1>
            </div>
            <div className="flex-1 overflow-y-auto">
                {conversations.map(convo => (
                    <Link
                        key={convo.id}
                        to={createPageUrl(`Chat?id=${convo.id}`)}
                        className={`block p-4 border-b border-l-4 transition-colors ${activeConversationId === convo.id ? 'bg-white border-blue-500' : 'border-transparent hover:bg-gray-100'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-gray-800 truncate">{convo.name || 'Conversation'}</p>
                                    {convo.last_message_timestamp && (
                                        <p className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                            {formatDistanceToNow(new Date(convo.last_message_timestamp), { addSuffix: true, locale: nl })}
                                        </p>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 truncate">{convo.last_message_preview || 'No messages yet'}</p>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}