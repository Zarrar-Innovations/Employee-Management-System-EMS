from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, Enum, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base, EmployeeStatus, AttendanceStatus, LeaveStatus, LeaveType, PayrollStatus, PaymentMethod, ReviewStatus

class Employee(Base):
    __tablename__ = "employees"
    
    employee_id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    phone = Column(String(20))
    date_of_birth = Column(Date)
    hire_date = Column(Date, nullable=False, default=datetime.now().date())
    job_title = Column(String(100))
    department = Column(String(100))
    salary = Column(Float, default=0.0)
    address = Column(Text)
    city = Column(String(50))
    state = Column(String(50))
    country = Column(String(50))
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    attendance_records = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    leaves = relationship("Leave", back_populates="employee", cascade="all, delete-orphan")
    payroll_records = relationship("Payroll", back_populates="employee", cascade="all, delete-orphan")
    performance_reviews = relationship("PerformanceReview", back_populates="employee", cascade="all, delete-orphan")
    reviewed_reviews = relationship("PerformanceReview", foreign_keys="PerformanceReview.reviewer_id", back_populates="reviewer")
    
    def __repr__(self):
        return f"<Employee {self.employee_id}: {self.first_name} {self.last_name}>"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def age(self):
        from datetime import date
        if self.date_of_birth:
            today = date.today()
            return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
        return None

class Department(Base):
    __tablename__ = "departments"
    
    department_id = Column(Integer, primary_key=True, index=True)
    department_name = Column(String(100), unique=True, nullable=False)
    manager_id = Column(Integer, ForeignKey("employees.employee_id", ondelete="SET NULL"))
    location = Column(String(100))
    budget = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    manager = relationship("Employee", foreign_keys=[manager_id])
    
    def __repr__(self):
        return f"<Department {self.department_id}: {self.department_name}>"

class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        CheckConstraint('hours_worked >= 0', name='check_hours_worked'),
    )
    
    attendance_id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    attendance_date = Column(Date, nullable=False, default=datetime.now().date())
    check_in = Column(String(8))  # HH:MM:SS format
    check_out = Column(String(8))  # HH:MM:SS format
    hours_worked = Column(Float, default=0.0)
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.PRESENT)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    employee = relationship("Employee", back_populates="attendance_records")
    
    def __repr__(self):
        return f"<Attendance {self.attendance_id}: {self.employee_id} on {self.attendance_date}>"

class Leave(Base):
    __tablename__ = "leaves"
    
    leave_id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    leave_type = Column(Enum(LeaveType), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_count = Column(Integer, default=1)
    status = Column(Enum(LeaveStatus), default=LeaveStatus.PENDING)
    reason = Column(Text)
    approved_by = Column(Integer, ForeignKey("employees.employee_id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    employee = relationship("Employee", back_populates="leaves", foreign_keys=[employee_id])
    approver = relationship("Employee", foreign_keys=[approved_by])
    
    def __repr__(self):
        return f"<Leave {self.leave_id}: {self.employee_id} {self.leave_type.value}>"

class Payroll(Base):
    __tablename__ = "payroll"
    __table_args__ = (
        CheckConstraint('basic_salary >= 0', name='check_basic_salary'),
        CheckConstraint('overtime_pay >= 0', name='check_overtime_pay'),
        CheckConstraint('bonuses >= 0', name='check_bonuses'),
        CheckConstraint('deductions >= 0', name='check_deductions'),
        CheckConstraint('tax_amount >= 0', name='check_tax_amount'),
        CheckConstraint('net_salary >= 0', name='check_net_salary'),
    )
    
    payroll_id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    pay_period_start = Column(Date, nullable=False)
    pay_period_end = Column(Date, nullable=False)
    basic_salary = Column(Float, nullable=False)
    overtime_pay = Column(Float, default=0.0)
    bonuses = Column(Float, default=0.0)
    deductions = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    net_salary = Column(Float, nullable=False)
    payment_date = Column(Date)
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.BANK_TRANSFER)
    status = Column(Enum(PayrollStatus), default=PayrollStatus.PENDING)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    employee = relationship("Employee", back_populates="payroll_records")
    
    def __repr__(self):
        return f"<Payroll {self.payroll_id}: {self.employee_id} {self.pay_period_start} to {self.pay_period_end}>"

class PerformanceReview(Base):
    __tablename__ = "performance_reviews"
    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='check_rating_range'),
    )
    
    review_id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    review_date = Column(Date, nullable=False, default=datetime.now().date())
    reviewer_id = Column(Integer, ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    rating = Column(Float, nullable=False)
    comments = Column(Text)
    goals = Column(Text)
    status = Column(Enum(ReviewStatus), default=ReviewStatus.PENDING)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    employee = relationship("Employee", back_populates="performance_reviews", foreign_keys=[employee_id])
    reviewer = relationship("Employee", back_populates="reviewed_reviews", foreign_keys=[reviewer_id])
    
    def __repr__(self):
        return f"<PerformanceReview {self.review_id}: {self.employee_id} rated {self.rating}>"