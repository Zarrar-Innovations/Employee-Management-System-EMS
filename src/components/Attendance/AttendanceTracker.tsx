import React, { useState, useEffect } from 'react';
import { supabase, Employee, Attendance } from '../../lib/supabase';
import { Clock, Calendar, CheckCircle, XCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const AttendanceTracker: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchAttendance();
  }, [selectedDate]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          departments (
            id,
            name
          )
        `)
        .eq('status', 'Active')
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      toast.error('Failed to fetch employees');
    }
  };

  const fetchAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          employees (
            id,
            name,
            employee_id
          )
        `)
        .eq('date', selectedDate);

      if (error) throw error;
      setAttendance(data || []);
    } catch (error) {
      toast.error('Failed to fetch attendance');
    }
  };

  const handleCheckIn = async (employeeId: string) => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const currentTime = new Date();
      const nineAM = new Date();
      nineAM.setHours(9, 0, 0, 0);
      
      const status = currentTime > nineAM ? 'Late' : 'Present';

      const { error } = await supabase
        .from('attendance')
        .upsert({
          employee_id: employeeId,
          date: selectedDate,
          check_in: now,
          status,
        }, {
          onConflict: 'employee_id,date'
        });

      if (error) throw error;
      
      toast.success('Check-in recorded successfully');
      fetchAttendance();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (attendanceId: string) => {
    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('attendance')
        .update({
          check_out: now,
        })
        .eq('id', attendanceId);

      if (error) throw error;
      
      toast.success('Check-out recorded successfully');
      fetchAttendance();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record check-out');
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceForEmployee = (employeeId: string) => {
    return attendance.find(att => att.employee_id === employeeId);
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
            <Clock className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Daily Attendance</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
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
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check In
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check Out
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Hours
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => {
                const empAttendance = getAttendanceForEmployee(employee.id);
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
                      {empAttendance?.check_in 
                        ? format(new Date(empAttendance.check_in), 'HH:mm:ss')
                        : '--:--:--'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {empAttendance?.check_out 
                        ? format(new Date(empAttendance.check_out), 'HH:mm:ss')
                        : '--:--:--'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {empAttendance?.total_hours 
                        ? `${empAttendance.total_hours.toFixed(2)}h`
                        : '0.00h'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        empAttendance?.status === 'Present' ? 'bg-green-100 text-green-800' :
                        empAttendance?.status === 'Late' ? 'bg-amber-100 text-amber-800' :
                        empAttendance?.status === 'Absent' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {empAttendance?.status || 'Not Marked'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        {!empAttendance?.check_in ? (
                          <button
                            onClick={() => handleCheckIn(employee.id)}
                            disabled={loading}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Check In
                          </button>
                        ) : !empAttendance.check_out ? (
                          <button
                            onClick={() => handleCheckOut(empAttendance.id)}
                            disabled={loading}
                            className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Check Out
                          </button>
                        ) : (
                          <span className="text-xs text-green-600 font-medium">Completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTracker;