from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, extract
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
import models
from database import EmployeeStatus, AttendanceStatus, LeaveStatus, LeaveType, PayrollStatus, PaymentMethod, ReviewStatus

class EmployeeOperations:
    def __init__(self, db: Session):
        self.db = db
    
    def create_employee(self, employee_data: dict) -> models.Employee:
        employee = models.Employee(**employee_data)
        self.db.add(employee)
        self.db.commit()
        self.db.refresh(employee)
        return employee
    
    def get_employee(self, employee_id: int) -> Optional[models.Employee]:
        return self.db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()
    
    def get_all_employees(self) -> List[models.Employee]:
        return self.db.query(models.Employee).order_by(models.Employee.employee_id).all()
    
    def update_employee(self, employee_id: int, employee_data: dict) -> Optional[models.Employee]:
        employee = self.get_employee(employee_id)
        if employee:
            for key, value in employee_data.items():
                setattr(employee, key, value)
            self.db.commit()
            self.db.refresh(employee)
        return employee
    
    def delete_employee(self, employee_id: int) -> bool:
        employee = self.get_employee(employee_id)
        if employee:
            self.db.delete(employee)
            self.db.commit()
            return True
        return False
    
    def search_employees(self, search_term: str) -> List[models.Employee]:
        return self.db.query(models.Employee).filter(
            or_(
                models.Employee.first_name.ilike(f"%{search_term}%"),
                models.Employee.last_name.ilike(f"%{search_term}%"),
                models.Employee.email.ilike(f"%{search_term}%"),
                models.Employee.job_title.ilike(f"%{search_term}%"),
                models.Employee.department.ilike(f"%{search_term}%")
            )
        ).all()
    
    def get_employees_by_department(self, department: str) -> List[models.Employee]:
        return self.db.query(models.Employee).filter(
            models.Employee.department.ilike(f"%{department}%")
        ).all()
    
    def get_employees_by_status(self, status: EmployeeStatus) -> List[models.Employee]:
        return self.db.query(models.Employee).filter(
            models.Employee.status == status
        ).all()
    
    def get_employee_count_by_department(self) -> Dict[str, int]:
        result = self.db.query(
            models.Employee.department,
            func.count(models.Employee.employee_id).label('count')
        ).group_by(models.Employee.department).all()
        
        return {dept: count for dept, count in result if dept}

class AttendanceOperations:
    def __init__(self, db: Session):
        self.db = db
    
    def mark_attendance(self, attendance_data: dict) -> models.Attendance:
        # Check if attendance already exists for the day
        existing = self.db.query(models.Attendance).filter(
            and_(
                models.Attendance.employee_id == attendance_data['employee_id'],
                models.Attendance.attendance_date == attendance_data['attendance_date']
            )
        ).first()
        
        if existing:
            # Update existing record
            for key, value in attendance_data.items():
                setattr(existing, key, value)
            self.db.commit()
            self.db.refresh(existing)
            return existing
        else:
            # Create new record
            attendance = models.Attendance(**attendance_data)
            self.db.add(attendance)
            self.db.commit()
            self.db.refresh(attendance)
            return attendance
    
    def get_attendance_by_employee(self, employee_id: int, start_date: date, end_date: date) -> List[models.Attendance]:
        return self.db.query(models.Attendance).filter(
            and_(
                models.Attendance.employee_id == employee_id,
                models.Attendance.attendance_date >= start_date,
                models.Attendance.attendance_date <= end_date
            )
        ).order_by(models.Attendance.attendance_date.desc()).all()
    
    def get_daily_attendance(self, attendance_date: date) -> List[models.Attendance]:
        return self.db.query(models.Attendance).filter(
            models.Attendance.attendance_date == attendance_date
        ).all()
    
    def calculate_monthly_summary(self, employee_id: int, year: int, month: int) -> Dict[str, Any]:
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        
        attendance_records = self.get_attendance_by_employee(employee_id, start_date, end_date)
        
        summary = {
            'total_days': len(attendance_records),
            'present_days': sum(1 for r in attendance_records if r.status == AttendanceStatus.PRESENT),
            'absent_days': sum(1 for r in attendance_records if r.status == AttendanceStatus.ABSENT),
            'late_days': sum(1 for r in attendance_records if r.status == AttendanceStatus.LATE),
            'half_days': sum(1 for r in attendance_records if r.status == AttendanceStatus.HALF_DAY),
            'leave_days': sum(1 for r in attendance_records if r.status == AttendanceStatus.LEAVE),
            'total_hours': sum(r.hours_worked for r in attendance_records)
        }
        
        return summary
    
    def get_attendance_summary_by_department(self, department: str, start_date: date, end_date: date) -> Dict[str, Any]:
        # Get all employees in department
        emp_ops = EmployeeOperations(self.db)
        employees = emp_ops.get_employees_by_department(department)
        
        if not employees:
            return {}
        
        summary = {
            'department': department,
            'total_employees': len(employees),
            'total_present': 0,
            'total_absent': 0,
            'total_late': 0,
            'attendance_rate': 0.0
        }
        
        for employee in employees:
            attendance_records = self.get_attendance_by_employee(employee.employee_id, start_date, end_date)
            if attendance_records:
                summary['total_present'] += sum(1 for r in attendance_records if r.status == AttendanceStatus.PRESENT)
                summary['total_absent'] += sum(1 for r in attendance_records if r.status == AttendanceStatus.ABSENT)
                summary['total_late'] += sum(1 for r in attendance_records if r.status == AttendanceStatus.LATE)
        
        total_days = len(employees) * ((end_date - start_date).days + 1)
        if total_days > 0:
            summary['attendance_rate'] = (summary['total_present'] / total_days) * 100
        
        return summary

class LeaveOperations:
    def __init__(self, db: Session):
        self.db = db
    
    def apply_leave(self, leave_data: dict) -> models.Leave:
        # Calculate days count
        start_date = leave_data['start_date']
        end_date = leave_data['end_date']
        leave_data['days_count'] = (end_date - start_date).days + 1
        
        leave = models.Leave(**leave_data)
        self.db.add(leave)
        self.db.commit()
        self.db.refresh(leave)
        return leave
    
    def get_leave(self, leave_id: int) -> Optional[models.Leave]:
        return self.db.query(models.Leave).filter(models.Leave.leave_id == leave_id).first()
    
    def get_leaves_by_employee(self, employee_id: int) -> List[models.Leave]:
        return self.db.query(models.Leave).filter(
            models.Leave.employee_id == employee_id
        ).order_by(models.Leave.start_date.desc()).all()
    
    def get_pending_leaves(self) -> List[models.Leave]:
        return self.db.query(models.Leave).filter(
            models.Leave.status == LeaveStatus.PENDING
        ).order_by(models.Leave.start_date).all()
    
    def update_leave_status(self, leave_id: int, status: LeaveStatus, approved_by: Optional[int] = None) -> Optional[models.Leave]:
        leave = self.get_leave(leave_id)
        if leave:
            leave.status = status
            if approved_by:
                leave.approved_by = approved_by
            self.db.commit()
            self.db.refresh(leave)
        return leave
    
    def check_leave_overlap(self, employee_id: int, start_date: date, end_date: date) -> bool:
        overlapping_leaves = self.db.query(models.Leave).filter(
            and_(
                models.Leave.employee_id == employee_id,
                models.Leave.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
                or_(
                    and_(models.Leave.start_date <= end_date, models.Leave.end_date >= start_date),
                    and_(start_date <= models.Leave.end_date, end_date >= models.Leave.start_date)
                )
            )
        ).count()
        
        return overlapping_leaves > 0
    
    def get_leave_summary_by_type(self, start_date: date, end_date: date) -> Dict[str, int]:
        result = self.db.query(
            models.Leave.leave_type,
            func.count(models.Leave.leave_id).label('count')
        ).filter(
            and_(
                models.Leave.start_date >= start_date,
                models.Leave.end_date <= end_date
            )
        ).group_by(models.Leave.leave_type).all()
        
        return {leave_type.value: count for leave_type, count in result}

class PayrollOperations:
    def __init__(self, db: Session):
        self.db = db
    
    def create_payroll(self, payroll_data: dict) -> models.Payroll:
        # Calculate net salary
        basic = payroll_data.get('basic_salary', 0)
        overtime = payroll_data.get('overtime_pay', 0)
        bonuses = payroll_data.get('bonuses', 0)
        deductions = payroll_data.get('deductions', 0)
        tax = payroll_data.get('tax_amount', 0)
        
        payroll_data['net_salary'] = basic + overtime + bonuses - deductions - tax
        
        payroll = models.Payroll(**payroll_data)
        self.db.add(payroll)
        self.db.commit()
        self.db.refresh(payroll)
        return payroll
    
    def get_payroll(self, payroll_id: int) -> Optional[models.Payroll]:
        return self.db.query(models.Payroll).filter(models.Payroll.payroll_id == payroll_id).first()
    
    def get_payroll_by_employee(self, employee_id: int) -> List[models.Payroll]:
        return self.db.query(models.Payroll).filter(
            models.Payroll.employee_id == employee_id
        ).order_by(models.Payroll.pay_period_start.desc()).all()
    
    def get_payroll_by_period(self, start_date: date, end_date: date) -> List[models.Payroll]:
        return self.db.query(models.Payroll).filter(
            and_(
                models.Payroll.pay_period_start >= start_date,
                models.Payroll.pay_period_end <= end_date
            )
        ).all()
    
    def update_payroll_status(self, payroll_id: int, status: PayrollStatus, payment_date: Optional[date] = None) -> Optional[models.Payroll]:
        payroll = self.get_payroll(payroll_id)
        if payroll:
            payroll.status = status
            if payment_date:
                payroll.payment_date = payment_date
            self.db.commit()
            self.db.refresh(payroll)
        return payroll
    
    def calculate_payroll_summary(self, start_date: date, end_date: date) -> Dict[str, Any]:
        payrolls = self.db.query(models.Payroll).filter(
            and_(
                models.Payroll.pay_period_start >= start_date,
                models.Payroll.pay_period_end <= end_date,
                models.Payroll.status == PayrollStatus.PAID
            )
        ).all()
        
        if not payrolls:
            return {}
        
        total_net = sum(p.net_salary for p in payrolls)
        total_basic = sum(p.basic_salary for p in payrolls)
        total_overtime = sum(p.overtime_pay for p in payrolls)
        total_bonuses = sum(p.bonuses for p in payrolls)
        total_deductions = sum(p.deductions for p in payrolls)
        total_tax = sum(p.tax_amount for p in payrolls)
        
        return {
            'total_employees': len(set(p.employee_id for p in payrolls)),
            'total_payrolls': len(payrolls),
            'total_net_salary': total_net,
            'total_basic_salary': total_basic,
            'total_overtime_pay': total_overtime,
            'total_bonuses': total_bonuses,
            'total_deductions': total_deductions,
            'total_tax': total_tax,
            'average_salary': total_net / len(payrolls) if payrolls else 0,
            'max_salary': max(p.net_salary for p in payrolls) if payrolls else 0,
            'min_salary': min(p.net_salary for p in payrolls) if payrolls else 0
        }
    
    def get_department_payroll_summary(self, department: str, start_date: date, end_date: date) -> Dict[str, Any]:
        # Get employees in department
        emp_ops = EmployeeOperations(self.db)
        employees = emp_ops.get_employees_by_department(department)
        
        if not employees:
            return {}
        
        employee_ids = [e.employee_id for e in employees]
        
        payrolls = self.db.query(models.Payroll).filter(
            and_(
                models.Payroll.employee_id.in_(employee_ids),
                models.Payroll.pay_period_start >= start_date,
                models.Payroll.pay_period_end <= end_date,
                models.Payroll.status == PayrollStatus.PAID
            )
        ).all()
        
        if not payrolls:
            return {}
        
        total_net = sum(p.net_salary for p in payrolls)
        
        return {
            'department': department,
            'total_employees': len(employees),
            'employees_paid': len(set(p.employee_id for p in payrolls)),
            'total_payrolls': len(payrolls),
            'total_net_salary': total_net,
            'average_salary': total_net / len(payrolls) if payrolls else 0
        }

class PerformanceOperations:
    def __init__(self, db: Session):
        self.db = db
    
    def create_review(self, review_data: dict) -> models.PerformanceReview:
        review = models.PerformanceReview(**review_data)
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        return review
    
    def get_review(self, review_id: int) -> Optional[models.PerformanceReview]:
        return self.db.query(models.PerformanceReview).filter(
            models.PerformanceReview.review_id == review_id
        ).first()
    
    def get_reviews_by_employee(self, employee_id: int) -> List[models.PerformanceReview]:
        return self.db.query(models.PerformanceReview).filter(
            models.PerformanceReview.employee_id == employee_id
        ).order_by(models.PerformanceReview.review_date.desc()).all()
    
    def get_average_rating(self, employee_id: int) -> float:
        result = self.db.query(
            func.avg(models.PerformanceReview.rating)
        ).filter(
            and_(
                models.PerformanceReview.employee_id == employee_id,
                models.PerformanceReview.status == ReviewStatus.COMPLETED
            )
        ).scalar()
        
        return float(result) if result else 0.0
    
    def get_department_performance(self, department: str) -> List[Dict[str, Any]]:
        emp_ops = EmployeeOperations(self.db)
        employees = emp_ops.get_employees_by_department(department)
        
        performance_data = []
        for employee in employees:
            avg_rating = self.get_average_rating(employee.employee_id)
            review_count = self.db.query(models.PerformanceReview).filter(
                and_(
                    models.PerformanceReview.employee_id == employee.employee_id,
                    models.PerformanceReview.status == ReviewStatus.COMPLETED
                )
            ).count()
            
            if review_count > 0:
                performance_data.append({
                    'employee_id': employee.employee_id,
                    'name': employee.full_name,
                    'department': employee.department,
                    'avg_rating': avg_rating,
                    'review_count': review_count,
                    'rating_level': self._get_rating_level(avg_rating)
                })
        
        # Sort by average rating descending
        performance_data.sort(key=lambda x: x['avg_rating'], reverse=True)
        return performance_data
    
    def _get_rating_level(self, rating: float) -> str:
        if rating >= 4.5:
            return "Excellent"
        elif rating >= 4.0:
            return "Very Good"
        elif rating >= 3.0:
            return "Good"
        elif rating >= 2.0:
            return "Needs Improvement"
        else:
            return "Unsatisfactory"
    
    def get_overall_performance_summary(self) -> Dict[str, Any]:
        # Get all completed reviews
        reviews = self.db.query(models.PerformanceReview).filter(
            models.PerformanceReview.status == ReviewStatus.COMPLETED
        ).all()
        
        if not reviews:
            return {}
        
        total_rating = sum(r.rating for r in reviews)
        avg_rating = total_rating / len(reviews)
        
        # Count by rating ranges
        rating_ranges = {
            'excellent': sum(1 for r in reviews if r.rating >= 4.5),
            'very_good': sum(1 for r in reviews if 4.0 <= r.rating < 4.5),
            'good': sum(1 for r in reviews if 3.0 <= r.rating < 4.0),
            'needs_improvement': sum(1 for r in reviews if 2.0 <= r.rating < 3.0),
            'unsatisfactory': sum(1 for r in reviews if r.rating < 2.0)
        }
        
        return {
            'total_reviews': len(reviews),
            'avg_rating': avg_rating,
            'max_rating': max(r.rating for r in reviews),
            'min_rating': min(r.rating for r in reviews),
            'rating_distribution': rating_ranges
        }

class DepartmentOperations:
    def __init__(self, db: Session):
        self.db = db
    
    def create_department(self, department_data: dict) -> models.Department:
        department = models.Department(**department_data)
        self.db.add(department)
        self.db.commit()
        self.db.refresh(department)
        return department
    
    def get_department(self, department_id: int) -> Optional[models.Department]:
        return self.db.query(models.Department).filter(
            models.Department.department_id == department_id
        ).first()
    
    def get_all_departments(self) -> List[models.Department]:
        return self.db.query(models.Department).order_by(models.Department.department_name).all()
    
    def update_department(self, department_id: int, department_data: dict) -> Optional[models.Department]:
        department = self.get_department(department_id)
        if department:
            for key, value in department_data.items():
                setattr(department, key, value)
            self.db.commit()
            self.db.refresh(department)
        return department
    
    def delete_department(self, department_id: int) -> bool:
        department = self.get_department(department_id)
        if department:
            self.db.delete(department)
            self.db.commit()
            return True
        return False
    
    def get_department_summary(self) -> List[Dict[str, Any]]:
        # Get all departments with employee counts and average salary
        departments = self.db.query(models.Department).all()
        
        summary = []
        for dept in departments:
            # Get employees in this department
            emp_ops = EmployeeOperations(self.db)
            employees = emp_ops.get_employees_by_department(dept.department_name)
            
            if employees:
                total_salary = sum(e.salary for e in employees)
                avg_salary = total_salary / len(employees)
            else:
                total_salary = 0
                avg_salary = 0
            
            summary.append({
                'department_id': dept.department_id,
                'department_name': dept.department_name,
                'manager': dept.manager.full_name if dept.manager else 'Not Assigned',
                'employee_count': len(employees),
                'active_count': sum(1 for e in employees if e.status == EmployeeStatus.ACTIVE),
                'total_salary_budget': total_salary,
                'average_salary': avg_salary,
                'location': dept.location,
                'budget': dept.budget
            })
        
        return summary