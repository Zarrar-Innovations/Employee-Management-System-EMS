import React, { useState, useEffect } from 'react';
import { supabase, Employee } from '../../lib/supabase';
import { Clock, User, CheckCircle, XCircle, Search, Calendar, Building2, Phone, Mail, CreditCard } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import toast from 'react-hot-toast';

// Define Attendance type for better type safety
interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  status?: 'Present' | 'Late' | 'Absent';
  total_hours?: number;
}

const PublicAttendance: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [cnicIqama, setCnicIqama] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm:ss'));

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(format(new Date(), 'HH:mm:ss'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reusable function to fetch today's attendance
  const fetchTodayAttendance = async (employeeId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      if (data.check_in && data.check_out) {
        const hours = differenceInHours(new Date(data.check_out), new Date(data.check_in));
        data.total_hours = hours;
      }
      setTodayAttendance(data);
    } else {
      setTodayAttendance(null);
    }
  };

  const searchEmployee = async () => {
    if (!employeeId.trim() && !cnicIqama.trim()) {
      toast.error('Please enter either Employee ID or CNIC/Iqama');
      return;
    }

    setSearchLoading(true);
    try {
      let query = supabase
        .from('employees')
        .select(`
          *,
          departments (
            id,
            name
          )
        `)
        .eq('status', 'Active');

      if (employeeId.trim()) {
        query = query.eq('employee_id', employeeId.trim());
      } else {
        query = query.eq('cnic_iqama', cnicIqama.trim());
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        toast.error('Employee not found or inactive');
        setEmployee(null);
        setTodayAttendance(null);
        return;
      }

      setEmployee(data);
      await fetchTodayAttendance(data.id);
      toast.success('Employee found successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to search employee');
      setEmployee(null);
      setTodayAttendance(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!employee) return;

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const currentTime = new Date();
      const nineAM = new Date();
      nineAM.setHours(9, 0, 0, 0);

      const status = currentTime > nineAM ? 'Late' : 'Present';
      const today = format(new Date(), 'yyyy-MM-dd');

      const { error } = await supabase
        .from('attendance')
        .upsert({
          employee_id: employee.id,
          date: today,
          check_in: now,
          status,
        }, {
          onConflict: ['employee_id', 'date']
        });

      if (error) throw error;

      toast.success(`Check-in recorded successfully! Status: ${status}`);
      await fetchTodayAttendance(employee.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to record check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!employee || !todayAttendance) return;

    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('attendance')
        .update({
          check_out: now,
        })
        .eq('id', todayAttendance.id);

      if (error) throw error;

      toast.success('Check-out recorded successfully!');
      await fetchTodayAttendance(employee.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to record check-out');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmployeeId('');
    setCnicIqama('');
    setEmployee(null);
    setTodayAttendance(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Employee Attendance Portal</h1>
          <p className="text-gray-600 text-lg">Mark your daily attendance quickly and easily</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Find Your Profile</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={searchLoading}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  placeholder="Enter your Employee ID"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CNIC/Iqama Number
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={cnicIqama}
                  onChange={(e) => setCnicIqama(e.target.value)}
                  disabled={searchLoading}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  placeholder="Enter your CNIC/Iqama"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={searchEmployee}
              disabled={searchLoading}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
              {searchLoading ? 'Searching...' : 'Find Employee'}
            </button>
            
            {employee && (
              <button
                onClick={resetForm}
                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Search Another
              </button>
            )}
          </div>
        </div>

        {/* Employee Details & Attendance */}
        {employee && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Employee Profile Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
                  {employee.profile_image_url ? (
                    <img
                      src={employee.profile_image_url}
                      alt={employee.name}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-2xl">
                      {employee.name?.charAt(0).toUpperCase() || ''}
                    </span>
                  )}
                </div>
                <div className="text-center md:text-left">
                  <h2 className="text-3xl font-bold mb-2">{employee.name || 'Unknown'}</h2>
                  <p className="text-blue-100 text-lg mb-1">{employee.position || 'Employee'}</p>
                  <p className="text-blue-200">ID: {employee.employee_id}</p>
                </div>
              </div>
            </div>

            {/* Employee Details */}
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="font-medium text-gray-900">{employee.departments?.name || 'Not assigned'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{employee.email || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">{employee.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Hire Date</p>
                    <p className="font-medium text-gray-900">
                      {employee.hire_date ? format(new Date(employee.hire_date), 'MMM dd, yyyy') : 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Today's Attendance */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-blue-600" />
                  Today's Attendance - {format(new Date(), 'EEEE, MMMM dd, yyyy')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Check In Time</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {todayAttendance?.check_in 
                        ? format(new Date(todayAttendance.check_in), 'HH:mm:ss')
                        : '--:--:--'
                      }
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Check Out Time</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {todayAttendance?.check_out 
                        ? format(new Date(todayAttendance.check_out), 'HH:mm:ss')
                        : '--:--:--'
                      }
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Total Hours</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {todayAttendance?.total_hours 
                        ? `${todayAttendance.total_hours.toFixed(2)}h`
                        : '0.00h'
                      }
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                {todayAttendance && (
                  <div className="mb-6">
                    <span className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${
                      todayAttendance.status === 'Present' ? 'bg-green-100 text-green-800' :
                      todayAttendance.status === 'Late' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      Status: {todayAttendance.status || 'Unknown'}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {!todayAttendance?.check_in ? (
                    <button
                      onClick={handleCheckIn}
                      disabled={loading}
                      className="flex items-center justify-center gap-3 px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl"
                    >
                      <CheckCircle className="w-6 h-6" />
                      <span className="font-semibold">Check In</span>
                    </button>
                  ) : !todayAttendance.check_out ? (
                    <button
                      onClick={handleCheckOut}
                      disabled={loading}
                      className="flex items-center justify-center gap-3 px-8 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl"
                    >
                      <XCircle className="w-6 h-6" />
                      <span className="font-semibold">Check Out</span>
                    </button>
                  ) : (
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-100 text-blue-800 rounded-xl">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-semibold">Attendance Complete for Today</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Current Time Display */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">Current Time</p>
                  <p className="text-xl font-mono font-bold text-gray-900">
                    {currentTime}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!employee && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-4">How to Mark Attendance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mb-3 font-bold">1</div>
                <h4 className="font-semibold text-gray-900 mb-2">Enter Your Details</h4>
                <p className="text-sm text-gray-600">Enter either your Employee ID or CNIC/Iqama number to find your profile</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center mb-3 font-bold">2</div>
                <h4 className="font-semibold text-gray-900 mb-2">Verify Information</h4>
                <p className="text-sm text-gray-600">Check that your profile information is correct before marking attendance</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center mb-3 font-bold">3</div>
                <h4 className="font-semibold text-gray-900 mb-2">Mark Attendance</h4>
                <p className="text-sm text-gray-600">Click Check In when you arrive and Check Out when you leave</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicAttendance;