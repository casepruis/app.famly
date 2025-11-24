import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useLanguage } from '@/components/common/LanguageProvider';

export default function InlineWishlistReview({ item, itemIndex, familyMembers, onWishlistUpdate }) {
  const { t } = useLanguage();

  const handleUpdate = (field, value) => {
    onWishlistUpdate(itemIndex, { ...item, [field]: value });
  };

  const handleMemberAssignmentChange = (memberId, checked) => {
    handleUpdate('family_member_id', checked ? memberId : null);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-2 bg-purple-50/80 border border-purple-200/90 rounded-lg text-sm sm:text-xs w-full shadow-sm">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Checkbox
          id={`wishlist-select-${itemIndex}`}
          checked={item.selected || false}
          onCheckedChange={(checked) => handleUpdate('selected', checked)}
          className="h-4 w-4 flex-shrink-0"
        />
        <Input
          value={item.name}
          onChange={(e) => handleUpdate('name', e.target.value)}
          className="flex-1 h-8 sm:h-7 text-sm sm:text-xs border-purple-300 bg-white min-w-0"
          placeholder={t('wishlistItemName') || 'Wishlist item'}
        />
      </div>
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 pl-7 sm:pl-0">
        {familyMembers.map(member => (
          <div key={member.id} className="flex items-center gap-1.5 whitespace-nowrap">
            <Checkbox
              id={`wishlist-${itemIndex}-member-${member.id}`}
              checked={item.family_member_id === member.id}
              onCheckedChange={(checked) => handleMemberAssignmentChange(member.id, checked)}
              className="h-4 w-4"
            />
            <label htmlFor={`wishlist-${itemIndex}-member-${member.id}`} className="text-sm sm:text-xs font-medium text-purple-800 cursor-pointer">{member.name}</label>
          </div>
        ))}
      </div>
    </div>
  );
}
