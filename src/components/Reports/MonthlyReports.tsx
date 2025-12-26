import React, { useState, useEffect } from 'react';
import { supabase, Employee, Attendance, Department } from '../../lib/supabase';
import { Download, Filter, Calendar, Users, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';

const MonthlyReports: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchReportData();
  }, [selectedMonth, selectedDepartment]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      toast.error('Failed to fetch departments');
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(new Date(selectedMonth + '-01'));
      const endDate = endOfMonth(new Date(selectedMonth + '-01'));

      // Build employee query
      let employeeQuery = supabase
        .from('employees')
        .select(`
          *,
          departments (
            id,
            name
          )
        `);

      if (selectedDepartment !== 'All') {
        employeeQuery = employeeQuery.eq('department_id', selectedDepartment);
      }

      const { data: employeeData, error: empError } = await employeeQuery;
      if (empError) throw empError;

      // Fetch attendance for the selected period
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance')
        .select(`
          *,
          employees (
            id,
            name,
            employee_id,
            department_id
          )
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (attError) throw attError;

      setEmployees(employeeData || []);
      setAttendance(attendanceData || []);
    } catch (error) {
      toast.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const calculateEmployeeStats = (employeeId: string) => {
    const empAttendance = attendance.filter(att => att.employee_id === employeeId);
    const totalDays = empAttendance.length;
    const presentDays = empAttendance.filter(att => att.status === 'Present').length;
    const lateDays = empAttendance.filter(att => att.status === 'Late').length;
    const totalHours = empAttendance.reduce((sum, att) => sum + (att.total_hours || 0), 0);

    return {
      totalDays,
      presentDays,
      lateDays,
      totalHours: totalHours.toFixed(2),
      attendanceRate: totalDays > 0 ? ((presentDays + lateDays) / totalDays * 100).toFixed(1) : '0',
    };
  };

  const exportToExcel = () => {
    const reportData = employees.map(employee => {
      const stats = calculateEmployeeStats(employee.id);
      return {
        'Employee ID': employee.employee_id,
        'Name': employee.name,
        'Department': employee.departments?.name,
        'Position': employee.position || '',
        'Total Days': stats.totalDays,
        'Present Days': stats.presentDays,
        'Late Days': stats.lateDays,
        'Total Hours': stats.totalHours,
        'Attendance Rate (%)': stats.attendanceRate,
        'Status': employee.status,
        'Salary': employee.salary,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    
    // Set column widths
    const colWidths = [
      { wch: 12 }, // Employee ID
      { wch: 20 }, // Name
      { wch: 15 }, // Department
      { wch: 20 }, // Position
      { wch: 12 }, // Total Days
      { wch: 12 }, // Present Days
      { wch: 10 }, // Late Days
      { wch: 12 }, // Total Hours
      { wch: 18 }, // Attendance Rate
      { wch: 10 }, // Status
      { wch: 12 }, // Salary
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Monthly Report');
    
    const fileName = `Employee_Report_${selectedMonth}_${selectedDepartment !== 'All' ? selectedDepartment : 'All_Departments'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success('Report exported successfully');
  };

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Monthly Reports</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="All">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Days
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Present
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Late
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Hours
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => {
                  const stats = calculateEmployeeStats(employee.id);
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                            {employee.profile_image_url ? (
                              <img
                                src={employee.profile_image_url}
                                alt={employee.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-gray-600 text-sm font-medium">
                                {employee.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                            <div className="text-xs text-gray-500">ID: {employee.employee_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.departments?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {stats.totalDays}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {stats.presentDays}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600 font-medium">
                        {stats.lateDays}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {stats.totalHours}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          parseFloat(stats.attendanceRate) >= 90 ? 'bg-green-100 text-green-800' :
                          parseFloat(stats.attendanceRate) >= 75 ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {stats.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyReports;