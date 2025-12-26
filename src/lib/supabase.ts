import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  cnic_iqama: string;
  phone: string | null;
  department_id: string;
  status: 'Active' | 'On Leave' | 'Inactive';
  hire_date: string;
  profile_image_url: string | null;
  salary: number;
  position: string | null;
  created_at: string;
  updated_at: string;
  departments?: Department;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  break_hours: number;
  total_hours: number | null;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day';
  notes: string | null;
  created_at: string;
  employees?: Employee;
}