
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, Calendar, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/common/LanguageProvider";

export default function QuickStats({ stats }) {
  const { t } = useLanguage();
  
  const statCards = [
    {
      title: t('tasksDueToday'),
      value: stats.tasksDueToday || 0,
      icon: CheckCircle,
      color: "from-green-400 to-green-600",
      bgColor: "bg-green-50",
      textColor: "text-green-600",
      url: createPageUrl("Tasks")
    },
    {
      title: t('upcomingEvents'),
      value: stats.upcomingEvents || 0,
      icon: Calendar,
      color: "from-blue-400 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      url: createPageUrl("Schedule")
    },
    {
      title: t('familyMembers'),
      value: stats.familyMembers || 0,
      icon: Users,
      color: "from-purple-400 to-purple-600",
      bgColor: "bg-purple-50",
      textColor: "text-purple-600",
      url: createPageUrl("FamilyMembers")
    },
    {
      title: t('activeGoals'),
      value: stats.activeGoals || 0,
      icon: Clock,
      color: "from-orange-400 to-orange-600",
      bgColor: "bg-orange-50",
      textColor: "text-orange-600",
      url: createPageUrl("Tasks?status=in_progress")
    }
  ];

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-4">{t('quickStats')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Link to={stat.url} key={stat.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card id={`quick-stat-${index}`} className="hover:shadow-lg transition-all duration-300 border-none shadow-md h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 ${stat.textColor}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
