from tabulate import tabulate
from datetime import date, datetime, timedelta
from typing import List, Dict, Any
from operations import *
from database import SessionLocal, get_db
import models

class EMSReports:
    def __init__(self, db_session):
        self.db = db_session
        self.emp_ops = EmployeeOperations(db_session)
        self.att_ops = AttendanceOperations(db_session)
        self.leave_ops = LeaveOperations(db_session)
        self.payroll_ops = PayrollOperations(db_session)
        self.perf_ops = PerformanceOperations(db_session)
        self.dept_ops = DepartmentOperations(db_session)
    
    def generate_employee_report(self, department: str = None, status: str = None) -> str:
        if department:
            employees = self.emp_ops.get_employees_by_department(department)
        elif status:
            status_enum = getattr(models.EmployeeStatus, status.upper().replace(' ', '_'))
            employees = self.emp_ops.get_employees_by_status(status_enum)
        else:
            employees = self.emp_ops.get_all_employees()
        
        headers = ["ID", "Name", "Email", "Phone", "Department", "Job Title", "Salary", "Status", "Hire Date"]
        table_data = []
        
        for emp in employees:
            table_data.append([
                emp.employee_id,
                emp.full_name,
                emp.email,
                emp.phone or "N/A",
                emp.department or "N/A",
                emp.job_title or "N/A",
                f"${emp.salary:,.2f}" if emp.salary else "N/A",
                emp.status.value,
                emp.hire_date.strftime("%Y-%m-%d")
            ])
        
        return tabulate(table_data, headers=headers, tablefmt="grid")
    
    def generate_attendance_report(self, start_date: date, end_date: date, department: str = None) -> str:
        if department:
            employees = self.emp_ops.get_employees_by_department(department)
        else:
            employees = self.emp_ops.get_all_employees()
        
        headers = ["ID", "Name", "Department", "Present", "Absent", "Late", "Half-day", "Leave", "Total Hours"]
        table_data = []
        
        total_present = total_absent = total_late = total_half_day = total_leave = total_hours = 0
        
        for emp in employees:
            summary = self.att_ops.calculate_monthly_summary(
                emp.employee_id, start_date.year, start_date.month
            )
            
            present = summary.get('present_days', 0)
            absent = summary.get('absent_days', 0)
            late = summary.get('late_days', 0)
            half_day = summary.get('half_days', 0)
            leave_days = summary.get('leave_days', 0)
            hours = summary.get('total_hours', 0)
            
            table_data.append([
                emp.employee_id,
                emp.full_name,
                emp.department or "N/A",
                present,
                absent,
                late,
                half_day,
                leave_days,
                f"{hours:.1f}"
            ])
            
            total_present += present
            total_absent += absent
            total_late += late
            total_half_day += half_day
            total_leave += leave_days
            total_hours += hours
        
        # Add summary row
        table_data.append([
            "TOTAL",
            "",
            "",
            total_present,
            total_absent,
            total_late,
            total_half_day,
            total_leave,
            f"{total_hours:.1f}"
        ])
        
        report = tabulate(table_data, headers=headers, tablefmt="grid")
        
        # Calculate attendance rate
        total_days = len(employees) * ((end_date - start_date).days + 1)
        if total_days > 0:
            attendance_rate = (total_present / total_days) * 100
            report += f"\n\nOverall Attendance Rate: {attendance_rate:.1f}%"
        
        return report
    
    def generate_payroll_report(self, start_date: date, end_date: date) -> str:
        payrolls = self.payroll_ops.get_payroll_by_period(start_date, end_date)
        summary = self.payroll_ops.calculate_payroll_summary(start_date, end_date)
        
        headers = ["Payroll ID", "Employee", "Department", "Period", "Basic", "Overtime", 
                  "Bonuses", "Deductions", "Tax", "Net Salary", "Status"]
        table_data = []
        
        for payroll in payrolls:
            emp = self.emp_ops.get_employee(payroll.employee_id)
            period = f"{payroll.pay_period_start} to {payroll.pay_period_end}"
            
            table_data.append([
                payroll.payroll_id,
                emp.full_name if emp else "N/A",
                emp.department if emp else "N/A",
                period,
                f"${payroll.basic_salary:,.2f}",
                f"${payroll.overtime_pay:,.2f}",
                f"${payroll.bonuses:,.2f}",
                f"${payroll.deductions:,.2f}",
                f"${payroll.tax_amount:,.2f}",
                f"${payroll.net_salary:,.2f}",
                payroll.status.value
            ])
        
        report = tabulate(table_data, headers=headers, tablefmt="grid")
        
        # Add summary
        if summary:
            report += f"\n\nPayroll Summary ({start_date} to {end_date}):\n"
            report += f"{'='*50}\n"
            report += f"Total Employees Paid: {summary.get('total_employees', 0)}\n"
            report += f"Total Payroll Records: {summary.get('total_payrolls', 0)}\n"
            report += f"Total Net Salary: ${summary.get('total_net_salary', 0):,.2f}\n"
            report += f"Average Salary: ${summary.get('average_salary', 0):,.2f}\n"
            report += f"Maximum Salary: ${summary.get('max_salary', 0):,.2f}\n"
            report += f"Minimum Salary: ${summary.get('min_salary', 0):,.2f}\n"
            report += f"{'='*50}\n"
            report += f"Breakdown:\n"
            report += f"  Basic Salary: ${summary.get('total_basic_salary', 0):,.2f}\n"
            report += f"  Overtime Pay: ${summary.get('total_overtime_pay', 0):,.2f}\n"
            report += f"  Bonuses: ${summary.get('total_bonuses', 0):,.2f}\n"
            report += f"  Deductions: ${summary.get('total_deductions', 0):,.2f}\n"
            report += f"  Tax: ${summary.get('total_tax', 0):,.2f}\n"
        
        return report
    
    def generate_leave_report(self, status: str = None, leave_type: str = None) -> str:
        # Build query based on filters
        query = self.db.query(models.Leave)
        
        if status:
            status_enum = getattr(models.LeaveStatus, status.upper())
            query = query.filter(models.Leave.status == status_enum)
        
        if leave_type:
            type_enum = getattr(models.LeaveType, leave_type.upper())
            query = query.filter(models.Leave.leave_type == type_enum)
        
        leaves = query.order_by(models.Leave.start_date.desc()).all()
        
        headers = ["Leave ID", "Employee", "Department", "Type", "Start Date", 
                  "End Date", "Days", "Status", "Reason"]
        table_data = []
        
        for leave in leaves:
            emp = self.emp_ops.get_employee(leave.employee_id)
            reason_preview = (leave.reason[:30] + "...") if leave.reason and len(leave.reason) > 30 else (leave.reason or "N/A")
            
            table_data.append([
                leave.leave_id,
                emp.full_name if emp else "N/A",
                emp.department if emp else "N/A",
                leave.leave_type.value,
                leave.start_date.strftime("%Y-%m-%d"),
                leave.end_date.strftime("%Y-%m-%d"),
                leave.days_count,
                leave.status.value,
                reason_preview
            ])
        
        if not table_data:
            return "No leave records found with the specified filters."
        
        report = tabulate(table_data, headers=headers, tablefmt="grid")
        
        # Add statistics
        if not status and not leave_type:
            total_leaves = len(leaves)
            pending = sum(1 for l in leaves if l.status == models.LeaveStatus.PENDING)
            approved = sum(1 for l in leaves if l.status == models.LeaveStatus.APPROVED)
            rejected = sum(1 for l in leaves if l.status == models.LeaveStatus.REJECTED)
            
            report += f"\n\nLeave Statistics:\n"
            report += f"{'='*40}\n"
            report += f"Total Leaves: {total_leaves}\n"
            report += f"Pending: {pending} ({pending/total_leaves*100:.1f}%)\n"
            report += f"Approved: {approved} ({approved/total_leaves*100:.1f}%)\n"
            report += f"Rejected: {rejected} ({rejected/total_leaves*100:.1f}%)\n"
        
        return report
    
    def generate_performance_report(self, department: str = None) -> str:
        if department:
            performance_data = self.perf_ops.get_department_performance(department)
            
            if not performance_data:
                return f"No performance data found for department: {department}"
            
            headers = ["ID", "Name", "Department", "Avg Rating", "Review Count", "Rating Level"]
            table_data = []
            
            for data in performance_data:
                table_data.append([
                    data['employee_id'],
                    data['name'],
                    data['department'],
                    f"{data['avg_rating']:.1f}",
                    data['review_count'],
                    data['rating_level']
                ])
            
            report = tabulate(table_data, headers=headers, tablefmt="grid")
            
            # Add department summary
            avg_rating_all = sum(d['avg_rating'] for d in performance_data) / len(performance_data)
            report += f"\n\nDepartment {department} Performance Summary:\n"
            report += f"Average Rating: {avg_rating_all:.1f}/5.0\n"
            report += f"Total Employees Reviewed: {len(performance_data)}\n"
            
        else:
            # Overall performance report
            summary = self.perf_ops.get_overall_performance_summary()
            
            if not summary:
                return "No performance data available."
            
            report = "Overall Performance Report\n"
            report += "="*50 + "\n"
            report += f"Total Reviews: {summary['total_reviews']}\n"
            report += f"Average Rating: {summary['avg_rating']:.1f}/5.0\n"
            report += f"Highest Rating: {summary['max_rating']:.1f}\n"
            report += f"Lowest Rating: {summary['min_rating']:.1f}\n\n"
            
            report += "Rating Distribution:\n"
            dist = summary['rating_distribution']
            report += f"  Excellent (4.5+): {dist['excellent']}\n"
            report += f"  Very Good (4.0-4.5): {dist['very_good']}\n"
            report += f"  Good (3.0-4.0): {dist['good']}\n"
            report += f"  Needs Improvement (2.0-3.0): {dist['needs_improvement']}\n"
            report += f"  Unsatisfactory (<2.0): {dist['unsatisfactory']}\n"
        
        return report
    
    def generate_department_summary(self) -> str:
        summary_data = self.dept_ops.get_department_summary()
        
        if not summary_data:
            return "No department data available."
        
        headers = ["Dept ID", "Department", "Manager", "Employees", "Active", 
                  "Avg Salary", "Total Salary", "Budget", "Location"]
        table_data = []
        
        for dept in summary_data:
            table_data.append([
                dept['department_id'],
                dept['department_name'],
                dept['manager'],
                dept['employee_count'],
                dept['active_count'],
                f"${dept['average_salary']:,.2f}",
                f"${dept['total_salary_budget']:,.2f}",
                f"${dept['budget']:,.2f}" if dept['budget'] else "N/A",
                dept['location'] or "N/A"
            ])
        
        report = tabulate(table_data, headers=headers, tablefmt="grid")
        
        # Add totals
        total_employees = sum(d['employee_count'] for d in summary_data)
        total_active = sum(d['active_count'] for d in summary_data)
        total_salary = sum(d['total_salary_budget'] for d in summary_data)
        
        report += f"\n\nOverall Summary:\n"
        report += f"Total Departments: {len(summary_data)}\n"
        report += f"Total Employees: {total_employees}\n"
        report += f"Active Employees: {total_active}\n"
        report += f"Total Salary Budget: ${total_salary:,.2f}\n"
        
        return report
    
    def generate_employee_detail_report(self, employee_id: int) -> str:
        employee = self.emp_ops.get_employee(employee_id)
        
        if not employee:
            return f"Employee with ID {employee_id} not found."
        
        report = f"EMPLOYEE DETAIL REPORT\n"
        report += "="*60 + "\n"
        report += f"Employee ID: {employee.employee_id}\n"
        report += f"Name: {employee.full_name}\n"
        report += f"Email: {employee.email}\n"
        report += f"Phone: {employee.phone or 'N/A'}\n"
        report += f"Date of Birth: {employee.date_of_birth.strftime('%Y-%m-%d') if employee.date_of_birth else 'N/A'}\n"
        report += f"Age: {employee.age if employee.age else 'N/A'}\n"
        report += f"Hire Date: {employee.hire_date.strftime('%Y-%m-%d')}\n"
        report += f"Job Title: {employee.job_title or 'N/A'}\n"
        report += f"Department: {employee.department or 'N/A'}\n"
        report += f"Salary: ${employee.salary:,.2f}\n"
        report += f"Status: {employee.status.value}\n"
        report += f"Address: {employee.address or 'N/A'}\n"
        report += f"City: {employee.city or 'N/A'}, State: {employee.state or 'N/A'}, Country: {employee.country or 'N/A'}\n"
        report += "\n" + "="*60 + "\n\n"
        
        # Attendance summary (last 30 days)
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
        attendance_summary = self.att_ops.calculate_monthly_summary(employee_id, start_date.year, start_date.month)
        
        report += "ATTENDANCE SUMMARY (Last 30 days):\n"
        report += f"Present Days: {attendance_summary.get('present_days', 0)}\n"
        report += f"Absent Days: {attendance_summary.get('absent_days', 0)}\n"
        report += f"Late Days: {attendance_summary.get('late_days', 0)}\n"
        report += f"Total Hours Worked: {attendance_summary.get('total_hours', 0):.1f}\n\n"
        
        # Leave summary (current year)
        leaves = self.leave_ops.get_leaves_by_employee(employee_id)
        current_year_leaves = [l for l in leaves if l.start_date.year == date.today().year]
        
        report += "LEAVE SUMMARY (Current Year):\n"
        if current_year_leaves:
            total_days = sum(l.days_count for l in current_year_leaves)
            approved_days = sum(l.days_count for l in current_year_leaves if l.status == models.LeaveStatus.APPROVED)
            report += f"Total Leave Days Applied: {total_days}\n"
            report += f"Approved Leave Days: {approved_days}\n"
        else:
            report += "No leave records for current year.\n"
        
        report += "\n"
        
        # Performance rating
        avg_rating = self.perf_ops.get_average_rating(employee_id)
        report += f"PERFORMANCE RATING: {avg_rating:.1f}/5.0\n"
        
        # Recent payroll
        payrolls = self.payroll_ops.get_payroll_by_employee(employee_id)[:3]  # Last 3 payrolls
        
        if payrolls:
            report += "\nRECENT PAYROLLS:\n"
            for p in payrolls:
                report += f"  {p.pay_period_start} to {p.pay_period_end}: ${p.net_salary:,.2f} ({p.status.value})\n"
        
        return report
    
    def export_report_to_file(self, report_content: str, filename: str = "report.txt"):
        """Export report to a text file."""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(report_content)
            return f"Report exported successfully to {filename}"
        except Exception as e:
            return f"Error exporting report: {e}"