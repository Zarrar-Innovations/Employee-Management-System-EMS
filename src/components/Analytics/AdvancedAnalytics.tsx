import React, { useState, useEffect } from 'react';
import { supabase, Employee, Attendance, Department } from '../../lib/supabase';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const AdvancedAnalytics: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [loading, setLoading] = useState(false);

  // Analytics data states
  const [attendanceTrends, setAttendanceTrends] = useState<any[]>([]);
  const [departmentStats, setDepartmentStats] = useState<any[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<any[]>([]);
  const [employeePerformance, setEmployeePerformance] = useState<any[]>([]);
  const [hourlyDistribution, setHourlyDistribution] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedDepartment]);

  const fetchData = async () => {
    setLoading(true);
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

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*');

      if (deptError) throw deptError;

      // Fetch attendance data for the selected period
      let attendanceQuery = supabase
        .from('attendance')
        .select(`
          *,
          employees (
            id,
            name,
            employee_id,
            department_id,
            departments (
              name
            )
          )
        `)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      const { data: attendanceData, error: attError } = await attendanceQuery;
      if (attError) throw attError;

      setEmployees(employeeData || []);
      setDepartments(deptData || []);
      setAttendance(attendanceData || []);

      // Process analytics data
      processAnalyticsData(employeeData || [], deptData || [], attendanceData || []);
    } catch (error) {
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (empData: Employee[], deptData: Department[], attData: Attendance[]) => {
    // 1. Attendance Trends (Daily)
    const days = eachDayOfInterval({
      start: new Date(dateRange.start),
      end: new Date(dateRange.end)
    });

    const trendsData = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayAttendance = attData.filter(att => att.date === dayStr);
      
      return {
        date: format(day, 'MMM dd'),
        present: dayAttendance.filter(att => att.status === 'Present').length,
        late: dayAttendance.filter(att => att.status === 'Late').length,
        absent: dayAttendance.filter(att => att.status === 'Absent').length,
        halfDay: dayAttendance.filter(att => att.status === 'Half Day').length,
        total: dayAttendance.length
      };
    });

    // 2. Department Statistics
    const deptStats = deptData.map(dept => {
      const deptEmployees = empData.filter(emp => emp.department_id === dept.id);
      const deptAttendance = attData.filter(att => 
        deptEmployees.some(emp => emp.id === att.employee_id)
      );
      
      const totalPossibleDays = deptEmployees.length * days.length;
      const presentDays = deptAttendance.filter(att => att.status === 'Present' || att.status === 'Late').length;
      const attendanceRate = totalPossibleDays > 0 ? (presentDays / totalPossibleDays * 100) : 0;

      return {
        name: dept.name,
        employees: deptEmployees.length,
        attendanceRate: attendanceRate.toFixed(1),
        totalHours: deptAttendance.reduce((sum, att) => sum + (att.total_hours || 0), 0).toFixed(1),
        avgHoursPerEmployee: deptEmployees.length > 0 
          ? (deptAttendance.reduce((sum, att) => sum + (att.total_hours || 0), 0) / deptEmployees.length).toFixed(1)
          : '0'
      };
    });

    // 3. Employee Performance (Top performers by attendance rate)
    const empPerformance = empData.map(emp => {
      const empAttendance = attData.filter(att => att.employee_id === emp.id);
      const totalDays = empAttendance.length;
      const presentDays = empAttendance.filter(att => att.status === 'Present' || att.status === 'Late').length;
      const attendanceRate = totalDays > 0 ? (presentDays / totalDays * 100) : 0;
      const totalHours = empAttendance.reduce((sum, att) => sum + (att.total_hours || 0), 0);

      return {
        name: emp.name,
        department: emp.departments?.name || 'Unassigned',
        attendanceRate: attendanceRate.toFixed(1),
        totalHours: totalHours.toFixed(1),
        totalDays,
        presentDays
      };
    }).sort((a, b) => parseFloat(b.attendanceRate) - parseFloat(a.attendanceRate)).slice(0, 10);

    // 4. Hourly Distribution (Check-in times)
    const hourlyDist = Array.from({ length: 24 }, (_, hour) => {
      const checkIns = attData.filter(att => {
        if (!att.check_in) return false;
        const checkInHour = new Date(att.check_in).getHours();
        return checkInHour === hour;
      }).length;

      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        checkIns
      };
    }).filter(item => item.checkIns > 0);

    setAttendanceTrends(trendsData);
    setDepartmentStats(deptStats);
    setEmployeePerformance(empPerformance);
    setHourlyDistribution(hourlyDist);
  };

  const exportAnalyticsReport = () => {
    const workbook = XLSX.utils.book_new();

    // Department Stats Sheet
    const deptSheet = XLSX.utils.json_to_sheet(departmentStats);
    XLSX.utils.book_append_sheet(workbook, deptSheet, 'Department Analytics');

    // Employee Performance Sheet
    const empSheet = XLSX.utils.json_to_sheet(employeePerformance);
    XLSX.utils.book_append_sheet(workbook, empSheet, 'Employee Performance');

    // Attendance Trends Sheet
    const trendsSheet = XLSX.utils.json_to_sheet(attendanceTrends);
    XLSX.utils.book_append_sheet(workbook, trendsSheet, 'Attendance Trends');

    const fileName = `Analytics_Report_${dateRange.start}_to_${dateRange.end}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success('Analytics report exported successfully');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Advanced Analytics</h1>
        </div>
        <p className="text-purple-100">Comprehensive insights into employee attendance and performance</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="All">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={exportAnalyticsReport}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Attendance Trends Chart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Daily Attendance Trends
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={attendanceTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="present" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Present" />
                <Area type="monotone" dataKey="late" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Late" />
                <Area type="monotone" dataKey="absent" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Absent" />
                <Area type="monotone" dataKey="halfDay" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} name="Half Day" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Department Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-blue-600" />
                Department Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={departmentStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, employees }) => `${name} (${employees})`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="employees"
                  >
                    {departmentStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Department Attendance Rates
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentStats} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 100]} stroke="#6b7280" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} width={80} />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Attendance Rate']}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="attendanceRate" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Check-in Time Distribution */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Check-in Time Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourlyDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="checkIns" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Check-ins" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Performers */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Top Performers (Attendance Rate)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Present</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employeePerformance.map((emp, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                          index === 2 ? 'bg-amber-600' :
                          'bg-blue-500'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {emp.department}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${Math.min(parseFloat(emp.attendanceRate), 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{emp.attendanceRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {emp.totalHours}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {emp.presentDays}/{emp.totalDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Department Comparison */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Department Performance Comparison
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Hours/Employee</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {departmentStats.map((dept, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3`} style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <div className="text-sm font-medium text-gray-900">{dept.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dept.employees}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${Math.min(parseFloat(dept.attendanceRate), 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{dept.attendanceRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {dept.totalHours}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dept.avgHoursPerEmployee}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdvancedAnalytics;