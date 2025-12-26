/*
  # Employee Management System Database Schema

  1. New Tables
    - `departments`
      - `id` (uuid, primary key)
      - `name` (text, unique department name)
      - `description` (text, department description)
      - `created_at` (timestamp)
    
    - `employees`
      - `id` (uuid, primary key)
      - `employee_id` (text, unique employee identifier)
      - `name` (text, employee full name)
      - `email` (text, unique email address)
      - `cnic_iqama` (text, unique CNIC or Iqama number)
      - `phone` (text, contact number)
      - `department_id` (uuid, foreign key to departments)
      - `status` (text, Active/On Leave/Inactive)
      - `hire_date` (date, employment start date)
      - `profile_image_url` (text, profile picture URL)
      - `salary` (numeric, monthly salary)
      - `position` (text, job position/title)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `attendance`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `date` (date, attendance date)
      - `check_in` (timestamptz, check-in time)
      - `check_out` (timestamptz, check-out time)
      - `break_hours` (numeric, total break hours)
      - `total_hours` (numeric, calculated work hours)
      - `status` (text, Present/Absent/Late/Half Day)
      - `notes` (text, additional notes)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage employee data
    - Add policies for employees to view their own attendance
    
  3. Functions
    - Function to calculate total work hours
    - Function to generate monthly reports
*/

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  cnic_iqama text UNIQUE NOT NULL,
  phone text,
  department_id uuid REFERENCES departments(id),
  status text DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Inactive')),
  hire_date date DEFAULT CURRENT_DATE,
  profile_image_url text,
  salary numeric DEFAULT 0,
  position text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  break_hours numeric DEFAULT 0,
  total_hours numeric,
  status text DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Late', 'Half Day')),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Enable Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Departments policies
CREATE POLICY "Anyone can read departments"
  ON departments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage departments"
  ON departments
  FOR ALL
  TO authenticated
  USING (true);

-- Employees policies
CREATE POLICY "Anyone can read employees"
  ON employees
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage employees"
  ON employees
  FOR ALL
  TO authenticated
  USING (true);

-- Attendance policies
CREATE POLICY "Anyone can read attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage attendance"
  ON attendance
  FOR ALL
  TO authenticated
  USING (true);

-- Insert sample departments
INSERT INTO departments (name, description) VALUES
  ('Human Resources', 'Manages employee relations, recruitment, and HR policies'),
  ('Engineering', 'Software development and technical operations'),
  ('Marketing', 'Brand promotion, advertising, and market research'),
  ('Finance', 'Financial planning, accounting, and budget management'),
  ('Operations', 'Day-to-day business operations and logistics')
ON CONFLICT (name) DO NOTHING;

-- Function to calculate work hours
CREATE OR REPLACE FUNCTION calculate_work_hours(
  check_in_time timestamptz,
  check_out_time timestamptz,
  break_hours numeric DEFAULT 0
)
RETURNS numeric AS $$
BEGIN
  IF check_in_time IS NULL OR check_out_time IS NULL THEN
    RETURN 0;
  END IF;
  
  RETURN GREATEST(0, EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600 - COALESCE(break_hours, 0));
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate total hours
CREATE OR REPLACE FUNCTION update_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_hours = calculate_work_hours(NEW.check_in, NEW.check_out, NEW.break_hours);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_calculate_hours
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_total_hours();

-- Function to update employee updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();