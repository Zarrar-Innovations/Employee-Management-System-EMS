import React, { useState, useEffect } from 'react';
import { supabase, Employee, Attendance } from '../../lib/supabase';
import DashboardStats from './DashboardStats';
import AttendanceChart from './AttendanceChart';
import DepartmentChart from './DepartmentChart';
import { format, subDays } from 'date-fns';

const Dashboard: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    presentToday: 0,
    onLeaveCount: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch employees
      const { data: employeeData, error: empError } = await supabase
        .from('employees')
        .select(`
          *,
          departments (
            id,
            name
          )
        `);

      if (empError) throw empError;

      // Fetch today's attendance
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: todayAttendance, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', today);

      if (attError) throw attError;

      // Fetch last 7 days attendance for chart
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        return format(date, 'yyyy-MM-dd');
      }).reverse();

      const chartData = await Promise.all(
        last7Days.map(async (date) => {
          const { data } = await supabase
            .from('attendance')
            .select('status')
            .eq('date', date);

          const present = data?.filter(att => att.status === 'Present').length || 0;
          const late = data?.filter(att => att.status === 'Late').length || 0;
          const absent = data?.filter(att => att.status === 'Absent').length || 0;

          return {
            date: format(new Date(date), 'MMM dd'),
            present,
            late,
            absent,
          };
        })
      );

      // Calculate stats
      const totalEmployees = employeeData?.length || 0;
      const activeEmployees = employeeData?.filter(emp => emp.status === 'Active').length || 0;
      const presentToday = todayAttendance?.filter(att => att.status === 'Present' || att.status === 'Late').length || 0;
      const onLeaveCount = employeeData?.filter(emp => emp.status === 'On Leave').length || 0;

      // Department distribution
      const deptCounts = employeeData?.reduce((acc: any, emp) => {
        const deptName = emp.departments?.name || 'Unassigned';
        acc[deptName] = (acc[deptName] || 0) + 1;
        return acc;
      }, {});

      const departmentChartData = Object.entries(deptCounts || {}).map(([name, value]) => ({
        name,
        value: value as number,
      }));

      setEmployees(employeeData || []);
      setAttendanceData(chartData);
      setDepartmentData(departmentChartData);
      setStats({
        totalEmployees,
        activeEmployees,
        presentToday,
        onLeaveCount,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-500">
          Last updated: {format(new Date(), 'MMM dd, yyyy HH:mm')}
        </p>
      </div>

      <DashboardStats
        totalEmployees={stats.totalEmployees}
        activeEmployees={stats.activeEmployees}
        presentToday={stats.presentToday}
        onLeaveCount={stats.onLeaveCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttendanceChart data={attendanceData} />
        <DepartmentChart data={departmentData} />
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {employees.slice(0, 5).map((employee) => (
            <div key={employee.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                  <span className="text-gray-600 text-sm font-medium">
                    {employee.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{employee.name}</p>
                  <p className="text-xs text-gray-500">{employee.departments?.name}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                employee.status === 'Active' ? 'bg-green-100 text-green-800' :
                employee.status === 'On Leave' ? 'bg-amber-100 text-amber-800' :
                'bg-red-100 text-red-800'
              }`}>
                {employee.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;