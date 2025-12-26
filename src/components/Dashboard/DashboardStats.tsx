import React from 'react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, trend }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {trend && (
          <p className={`text-sm mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}% from last month
          </p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

interface DashboardStatsProps {
  totalEmployees: number;
  activeEmployees: number;
  presentToday: number;
  onLeaveCount: number;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({
  totalEmployees,
  activeEmployees,
  presentToday,
  onLeaveCount,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Total Employees"
        value={totalEmployees}
        icon={Users}
        color="bg-blue-500"
        trend={{ value: 8.5, isPositive: true }}
      />
      <StatCard
        title="Active Employees"
        value={activeEmployees}
        icon={UserCheck}
        color="bg-green-500"
        trend={{ value: 3.2, isPositive: true }}
      />
      <StatCard
        title="Present Today"
        value={presentToday}
        icon={Clock}
        color="bg-indigo-500"
        trend={{ value: 2.1, isPositive: false }}
      />
      <StatCard
        title="On Leave"
        value={onLeaveCount}
        icon={UserX}
        color="bg-amber-500"
        trend={{ value: 1.8, isPositive: false }}
      />
    </div>
  );
};

export default DashboardStats;