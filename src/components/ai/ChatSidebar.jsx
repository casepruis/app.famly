import React from 'react';
import { Users } from 'lucide-react';
import { useLanguage } from "@/components/common/LanguageProvider";

export default function ChatSidebar({ familyMembers, selectedConversationId, onSelectConversation }) {
  const { t } = useLanguage();
  
  const ConversationButton = ({ id, color, initial, name, isSelected, onClick }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2 rounded-lg text-sm font-medium transition-colors ${
        isSelected
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>
      <span className="truncate">{name}</span>
    </button>
  );

  return (
    <div className="p-2 space-y-1">
      <h2 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('conversations') || 'Conversations'}</h2>
      
      {/* All Family Chat */}
      <ConversationButton
        id="family"
        color="#4a5568"
        initial={<Users className="w-4 h-4" />}
        name={t('allFamily') || 'All Family'}
        isSelected={selectedConversationId === 'family'}
        onClick={() => onSelectConversation('family')}
      />

      {/* Separator */}
      <div className="pt-2">
        <h2 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('members') || 'Members'}</h2>
      </div>

      {/* Individual Member Chats */}
      {familyMembers.map(member => (
        <ConversationButton
          key={member.id}
          id={member.id}
          color={member.color || '#9ca3af'}
          initial={member.name.charAt(0).toUpperCase()}
          name={member.name}
          isSelected={selectedConversationId === member.id}
          onClick={() => onSelectConversation(member.id)}
        />
      ))}
    </div>
  );
}