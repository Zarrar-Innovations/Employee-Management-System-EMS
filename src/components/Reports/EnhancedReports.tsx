import React, { useState, useEffect } from 'react';
import { supabase, Employee, Attendance, Department } from '../../lib/supabase';
import { 
  Download, 
  Filter, 
  Calendar, 
  Users, 
  FileText,
  TrendingUp,
  Clock,
  Building2,
  Search,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const EnhancedReports: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [reportType, setReportType] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);

  useEffect(() => {
    fetchDepartments();
    fetchReportData();
  }, [reportType, selectedMonth, dateRange, selectedDepartment, selectedEmployee]);

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
      let startDate, endDate;
      
      if (reportType === 'monthly') {
        startDate = startOfMonth(new Date(selectedMonth + '-01'));
        endDate = endOfMonth(new Date(selectedMonth + '-01'));
      } else {
        startDate = new Date(dateRange.start);
        endDate = new Date(dateRange.end);
      }

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

      if (selectedEmployee !== 'All') {
        employeeQuery = employeeQuery.eq('id', selectedEmployee);
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
            department_id,
            departments (
              name
            )
          )
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (attError) throw attError;

      setEmployees(employeeData || []);
      setAttendance(attendanceData || []);

      // Process report data
      const processedData = processReportData(employeeData || [], attendanceData || [], startDate, endDate);
      setReportData(processedData);
    } catch (error) {
      toast.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const processReportData = (empData: Employee[], attData: Attendance[], startDate: Date, endDate: Date) => {
    const workingDays = eachDayOfInterval({ start: startDate, end: endDate })
      .filter(day => day.getDay() !== 0 && day.getDay() !== 6).length; // Exclude weekends

    return empData.map(employee => {
      const empAttendance = attData.filter(att => att.employee_id === employee.id);
      const totalDays = empAttendance.length;
      const presentDays = empAttendance.filter(att => att.status === 'Present').length;
      const lateDays = empAttendance.filter(att => att.status === 'Late').length;
      const absentDays = empAttendance.filter(att => att.status === 'Absent').length;
      const halfDays = empAttendance.filter(att => att.status === 'Half Day').length;
      const totalHours = empAttendance.reduce((sum, att) => sum + (att.total_hours || 0), 0);
      const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;
      const attendanceRate = workingDays > 0 ? ((presentDays + lateDays + halfDays) / workingDays * 100) : 0;

      // Calculate overtime (assuming 8 hours is standard)
      const standardHours = (presentDays + lateDays) * 8;
      const overtimeHours = Math.max(0, totalHours - standardHours);

      // Calculate early/late arrivals
      const earlyArrivals = empAttendance.filter(att => {
        if (!att.check_in) return false;
        const checkInTime = new Date(att.check_in);
        const nineAM = new Date(checkInTime);
        nineAM.setHours(9, 0, 0, 0);
        return checkInTime < nineAM;
      }).length;

      const lateArrivals = empAttendance.filter(att => {
        if (!att.check_in) return false;
        const checkInTime = new Date(att.check_in);
        const nineAM = new Date(checkInTime);
        nineAM.setHours(9, 0, 0, 0);
        return checkInTime > nineAM;
      }).length;

      return {
        employee,
        totalDays,
        presentDays,
        lateDays,
        absentDays,
        halfDays,
        totalHours: totalHours.toFixed(2),
        avgHoursPerDay: avgHoursPerDay.toFixed(2),
        attendanceRate: attendanceRate.toFixed(1),
        overtimeHours: overtimeHours.toFixed(2),
        earlyArrivals,
        lateArrivals,
        workingDays
      };
    });
  };

  const exportDetailedReport = () => {
    const workbook = XLSX.utils.book_new();

    // Summary Report
    const summaryData = reportData.map(item => ({
      'Employee ID': item.employee.employee_id,
      'Name': item.employee.name,
      'Department': item.employee.departments?.name,
      'Position': item.employee.position || '',
      'Email': item.employee.email,
      'Phone': item.employee.phone || '',
      'CNIC/Iqama': item.employee.cnic_iqama,
      'Status': item.employee.status,
      'Hire Date': format(new Date(item.employee.hire_date), 'yyyy-MM-dd'),
      'Salary': item.employee.salary,
      'Working Days': item.workingDays,
      'Total Days Marked': item.totalDays,
      'Present Days': item.presentDays,
      'Late Days': item.lateDays,
      'Absent Days': item.absentDays,
      'Half Days': item.halfDays,
      'Total Hours': item.totalHours,
      'Average Hours/Day': item.avgHoursPerDay,
      'Attendance Rate (%)': item.attendanceRate,
      'Overtime Hours': item.overtimeHours,
      'Early Arrivals': item.earlyArrivals,
      'Late Arrivals': item.lateArrivals,
    }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    
    // Set column widths
    const colWidths = [
      { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 25 },
      { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
      { wch: 12 }, { wch: 12 }
    ];
    summarySheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Employee Summary');

    // Department Summary
    const deptSummary = departments.map(dept => {
      const deptEmployees = reportData.filter(item => item.employee.department_id === dept.id);
      const totalEmployees = deptEmployees.length;
      const avgAttendanceRate = totalEmployees > 0 
        ? (deptEmployees.reduce((sum, emp) => sum + parseFloat(emp.attendanceRate), 0) / totalEmployees).toFixed(1)
        : '0';
      const totalHours = deptEmployees.reduce((sum, emp) => sum + parseFloat(emp.totalHours), 0);

      return {
        'Department': dept.name,
        'Description': dept.description || '',
        'Total Employees': totalEmployees,
        'Average Attendance Rate (%)': avgAttendanceRate,
        'Total Department Hours': totalHours.toFixed(2),
        'Average Hours per Employee': totalEmployees > 0 ? (totalHours / totalEmployees).toFixed(2) : '0'
      };
    });

    const deptSheet = XLSX.utils.json_to_sheet(deptSummary);
    XLSX.utils.book_append_sheet(workbook, deptSheet, 'Department Summary');

    // Daily Attendance Detail
    const dailyData: any[] = [];
    attendance.forEach(att => {
      dailyData.push({
        'Date': att.date,
        'Employee ID': att.employees?.employee_id,
        'Employee Name': att.employees?.name,
        'Department': att.employees?.departments?.name,
        'Check In': att.check_in ? format(new Date(att.check_in), 'HH:mm:ss') : '',
        'Check Out': att.check_out ? format(new Date(att.check_out), 'HH:mm:ss') : '',
        'Break Hours': att.break_hours,
        'Total Hours': att.total_hours,
        'Status': att.status,
        'Notes': att.notes || ''
      });
    });

    const dailySheet = XLSX.utils.json_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Attendance');

    const fileName = `Detailed_Report_${reportType === 'monthly' ? selectedMonth : `${dateRange.start}_to_${dateRange.end}`}_${selectedDepartment !== 'All' ? departments.find(d => d.id === selectedDepartment)?.name : 'All_Departments'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success('Detailed report exported successfully');
  };

  const filteredReportData = reportData.filter(item =>
    item.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Enhanced Reports</h1>
        </div>
        <p className="text-green-100">Comprehensive reporting with detailed analytics and insights</p>
      </div>

      {/* Report Controls */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="monthly">Monthly Report</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {reportType === 'monthly' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          ) : (
            <>
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
            </>
          )}

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="All">All Employees</option>
              {employees
                .filter(emp => selectedDepartment === 'All' || emp.department_id === selectedDepartment)
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
            </select>
          </div>

          <button
            onClick={exportDetailedReport}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
          />
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Employees</p>
                <p className="text-3xl font-bold text-gray-900">{reportData.length}</p>
              </div>
              <Users className="w-12 h-12 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Attendance Rate</p>
                <p className="text-3xl font-bold text-green-600">
                  {(reportData.reduce((sum, item) => sum + parseFloat(item.attendanceRate), 0) / reportData.length).toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hours</p>
                <p className="text-3xl font-bold text-blue-600">
                  {reportData.reduce((sum, item) => sum + parseFloat(item.totalHours), 0).toFixed(0)}h
                </p>
              </div>
              <Clock className="w-12 h-12 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overtime Hours</p>
                <p className="text-3xl font-bold text-amber-600">
                  {reportData.reduce((sum, item) => sum + parseFloat(item.overtimeHours), 0).toFixed(0)}h
                </p>
              </div>
              <Clock className="w-12 h-12 text-amber-500" />
            </div>
          </div>
        </div>
      )}

      {/* Detailed Report Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Detailed Employee Report
          </h3>
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present/Late/Absent</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Hours/Day</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punctuality</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReportData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                          {item.employee.profile_image_url ? (
                            <img
                              src={item.employee.profile_image_url}
                              alt={item.employee.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-600 font-medium">
                              {item.employee.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.employee.name}</div>
                          <div className="text-xs text-gray-500">ID: {item.employee.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.employee.departments?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className={`h-2 rounded-full ${
                              parseFloat(item.attendanceRate) >= 95 ? 'bg-green-500' :
                              parseFloat(item.attendanceRate) >= 85 ? 'bg-blue-500' :
                              parseFloat(item.attendanceRate) >= 75 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(parseFloat(item.attendanceRate), 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.attendanceRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex space-x-1">
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">{item.presentDays}P</span>
                        <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs">{item.lateDays}L</span>
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">{item.absentDays}A</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.totalHours}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.avgHoursPerDay}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        parseFloat(item.overtimeHours) > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.overtimeHours}h
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs">
                        <div className="text-green-600">Early: {item.earlyArrivals}</div>
                        <div className="text-red-600">Late: {item.lateArrivals}</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredReportData.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No data found for the selected criteria</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedReports;