// components/Employee/SalarySlip.jsx
import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Button,
  Form,
  Alert,
  Spinner,
  Badge,
  Modal,
  Container
} from 'react-bootstrap';
import {
  FaDownload,
  FaFilePdf,
  FaPrint,
  FaEye,
  FaCalendarAlt,
  FaRupeeSign,
  FaMoneyBillWave,
  FaHistory,
  FaTimes,
  FaCheckCircle,
  FaInfoCircle,
  FaClock,
  FaUserTie,
  FaSortNumericDown
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const SalarySlip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [salarySlips, setSalarySlips] = useState([]);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [joiningInfo, setJoiningInfo] = useState(null);
  const [eligibleMonths, setEligibleMonths] = useState([]);
  
  // Set current month as default
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [availableYears, setAvailableYears] = useState([]);
  const [months] = useState([
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ]);

  useEffect(() => {
    if (!user?.employeeId) {
      navigate('/login');
      return;
    }
    fetchEmployeeData();
    fetchSalarySlips();
    generateYearOptions();
  }, [user]);

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    // Generate years from joining year to current year + 1
    if (joiningInfo) {
      for (let i = joiningInfo.year; i <= currentYear + 1; i++) {
        years.push(i);
      }
    } else {
      for (let i = 2020; i <= currentYear + 1; i++) {
        years.push(i);
      }
    }
    setAvailableYears(years);
  };

  const generateEligibleMonths = (joiningInfo) => {
    if (!joiningInfo) return;
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const eligible = [];
    
    // Start from joining month/year
    let year = joiningInfo.year;
    let month = joiningInfo.month;
    
    // Loop until current month
    while (year < currentYear || (year === currentYear && month <= currentMonth)) {
      eligible.push({
        year: year,
        month: month,
        label: `${months.find(m => m.value === month)?.label} ${year}`
      });
      
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    
    setEligibleMonths(eligible);
  };

  const fetchEmployeeData = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/employees/profile/${user.employeeId}`);
      setEmployee(response.data);
    } catch (error) {
      console.error('Error fetching employee:', error);
    }
  };

  const fetchSalarySlips = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:5000/api/salary/employee/${user.employeeId}`);
      setSalarySlips(response.data.salarySlips || []);
      
      if (response.data.joiningInfo) {
        setJoiningInfo(response.data.joiningInfo);
        generateEligibleMonths(response.data.joiningInfo);
        
        // After setting joiningInfo, regenerate year options
        setTimeout(() => generateYearOptions(), 100);
      }
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      setMessage({
        type: 'danger',
        text: 'Failed to load salary slips'
      });
    } finally {
      setLoading(false);
    }
  };

  const isMonthEligible = (month, year) => {
    if (!joiningInfo) return true;
    
    const requestedDate = new Date(year, month - 1, 1);
    const joiningDate = new Date(joiningInfo.year, joiningInfo.month - 1, 1);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    // Check if requested date is before joining
    if (requestedDate < joiningDate) return false;
    
    // Check if requested date is in the future
    if (year > currentYear) return false;
    if (year === currentYear && month > currentMonth) return false;
    
    return true;
  };

  const handleGenerateSlip = async () => {
    if (!selectedMonth || !selectedYear) {
      setMessage({
        type: 'warning',
        text: 'Please select month and year'
      });
      return;
    }

    // Check if selected month is valid
    if (joiningInfo && !isMonthEligible(selectedMonth, selectedYear)) {
      let errorMessage = '';
      const requestedDate = new Date(selectedYear, selectedMonth - 1, 1);
      const joiningDate = new Date(joiningInfo.year, joiningInfo.month - 1, 1);
      const currentDate = new Date();
      
      if (requestedDate < joiningDate) {
        errorMessage = `You cannot generate salary slip for months before your joining date (${joiningInfo.formattedDate})`;
      } else if (requestedDate > currentDate) {
        errorMessage = 'You cannot generate salary slip for future months';
      }
      
      setMessage({
        type: 'danger',
        text: errorMessage
      });
      return;
    }

    // Check if slip already exists for this month/year
    const existingSlip = salarySlips.find(
      slip => slip.month === parseInt(selectedMonth) && slip.year === parseInt(selectedYear)
    );

    if (existingSlip) {
      setMessage({
        type: 'info',
        text: 'Salary slip already exists for this month'
      });
      setSelectedSlip(existingSlip);
      setShowSlipModal(true);
      return;
    }

    setGenerating(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axios.post('http://localhost:5000/api/salary/generate', {
        employee_id: user.employeeId,
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear)
      });

      setMessage({
        type: 'success',
        text: 'Salary slip generated successfully!'
      });

      // Refresh salary slips
      fetchSalarySlips();

      // Show the generated slip
      if (response.data.salarySlip) {
        setSelectedSlip(response.data.salarySlip);
        setShowSlipModal(true);
      }

    } catch (error) {
      console.error('Error generating salary slip:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to generate salary slip'
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleViewSlip = (slip) => {
    setSelectedSlip(slip);
    setShowSlipModal(true);
  };

  const handleDownloadPDF = async (slip) => {
    if (!slip || !employee) return;

    setSelectedSlip(slip);
    
    try {
      setMessage({
        type: 'info',
        text: 'Generating PDF...'
      });

      const { basicSalary, deduction, netSalary } = getSlipAmounts(slip);

      // Create PDF content as a string with proper HTML
      const pdfContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Salary Slip</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .header h1 {
              font-size: 28px;
              font-weight: bold;
              color: #000;
              margin: 0 0 5px 0;
            }
            .header p {
              font-size: 12px;
              color: #333;
              margin: 0;
            }
            .title {
              text-align: center;
              font-size: 18px;
              font-weight: bold;
              margin: 20px 0;
              text-decoration: underline;
            }
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 14px;
            }
            .details-table td {
              padding: 4px 0;
            }
            .salary-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 14px;
            }
            .salary-table th {
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              padding: 8px 4px;
              text-align: left;
            }
            .salary-table td {
              padding: 4px 4px;
            }
            .salary-table td:last-child {
              text-align: right;
            }
            .bg-light {
              background-color: #f2f2f2;
            }
            .bg-warning {
              background-color: #fff3cd;
            }
            .bg-success {
              background-color: #d4edda;
            }
            .text-danger {
              color: #d9534f;
            }
            .text-success {
              color: #28a745;
            }
            .fw-bold {
              font-weight: bold;
            }
            .net-salary {
              background-color: #d4edda;
              padding: 15px;
              margin-bottom: 20px;
              text-align: center;
            }
            .net-salary h3 {
              margin: 0;
              font-size: 20px;
              font-weight: bold;
              color: #28a745;
            }
            .calculation {
              background-color: #f8f9fa;
              padding: 10px;
              margin-bottom: 20px;
              border-radius: 5px;
              font-size: 13px;
            }
            .amount-words {
              font-size: 14px;
              margin-bottom: 30px;
            }
            .footer {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 20px;
              font-size: 14px;
            }
            .generated-date {
              text-align: right;
              margin-top: 10px;
              font-size: 11px;
              color: #6c757d;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>B2BinDemand</h1>
            <p>B2BinDemand, 8th Floor SkyVista, 805, Mhada Colony, Viman Nagar, Pune, Maharashtra 411014</p>
          </div>

          <div class="title">
            Salary Slip for the month of ${getMonthName(slip.month)}, ${slip.year}
          </div>

          <table class="details-table">
            <tr>
              <td style="width: 50%;"><strong>Name:</strong> ${employee?.first_name} ${employee?.last_name}</td>
              <td style="width: 50%;"><strong>Employee Code No:</strong> ${employee?.employee_id}</td>
            </tr>
            <tr>
              <td><strong>Date of Joining:</strong> ${new Date(employee?.joining_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              
            </tr>
          </table>

          <table class="salary-table">
            <thead>
              <tr>
                <th>Earnings</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Basic Salary</td>
                <td>${formatCurrency(basicSalary)}</td>
              </tr>
              <tr class="bg-light fw-bold">
                <td>Gross Earnings</td>
                <td>${formatCurrency(basicSalary)}</td>
              </tr>
            </tbody>
          </table>

          <table class="salary-table">
            <thead>
              <tr>
                <th>Deductions</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>PF (Provident Fund)</td>
                <td>0</td>
              </tr>
              <tr>
                <td>ESI (Employee State Insurance)</td>
                <td>0</td>
              </tr>
              <tr>
                <td>TDS (Tax Deducted at Source)</td>
                <td>0</td>
              </tr>
              <tr class="bg-warning fw-bold">
                <td>DT (Fixed Deduction)</td>
                <td class="text-danger">${formatCurrency(deduction)}</td>
              </tr>
              <tr class="bg-light fw-bold">
                <td>Total Deductions</td>
                <td class="text-danger">${formatCurrency(deduction)}</td>
              </tr>
              <!-- NET SALARY - FIXED: Now shows basic salary minus deduction -->
              <tr class="fw-bold" style="border-top: 2px solid #000;">
                <td>NET SALARY</td>
                <td class="text-success">${formatCurrency(netSalary)}</td>
              </tr>
            </tbody>
          </table>

          <div class="calculation">
            <strong>Calculation:</strong> Basic Salary (₹${formatCurrency(basicSalary)}) - DT Deduction (₹${formatCurrency(deduction)}) = Net Salary (₹${formatCurrency(netSalary)})
          </div>

          <div class="amount-words">
            <strong>Amount in Words:</strong> Rupees ${numberToWords(Math.round(netSalary))} Only
          </div>

          <div class="footer">
            <div>For B2BinDemand</div>
            <div>Authorized Signatory</div>
          </div>

          <div class="generated-date">
            Generated on: ${new Date().toLocaleString()}
          </div>
        </body>
        </html>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(pdfContent);
      iframeDoc.close();

      await new Promise(resolve => setTimeout(resolve, 1000));

      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        useCORS: true,
        windowWidth: 800,
        windowHeight: iframeDoc.body.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width * 0.75, canvas.height * 0.75]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width * 0.75, canvas.height * 0.75);
      pdf.save(`Salary_Slip_${slip.employee_id}_${getMonthName(slip.month)}_${slip.year}.pdf`);

      document.body.removeChild(iframe);

      setMessage({
        type: 'success',
        text: 'PDF downloaded successfully!'
      });

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);

    } catch (error) {
      console.error('Error generating PDF:', error);
      setMessage({
        type: 'danger',
        text: 'Failed to download PDF'
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0).replace('₹', '');
  };

  // FIXED: Correct calculation function
  const getSlipAmounts = (slip) => {
    if (!slip) {
      return { basicSalary: 0, deduction: 0, netSalary: 0 };
    }

    // Get basic salary from slip or employee
    const slipBase = Number(slip.basic_salary) || 0;
    const employeeBase = Number(employee?.gross_salary || employee?.salary) || 0;
    const basicSalary = slipBase > 0 ? slipBase : employeeBase;

    // Get deduction (DT - Fixed Deduction)
    const deduction = Number(slip.dt) || 200;

    // FIXED: Calculate net salary = basic salary - deduction
    const netSalary = basicSalary - deduction;

    return {
      basicSalary,
      deduction,
      netSalary
    };
  };

  const getMonthName = (monthNumber) => {
    const month = months.find(m => m.value === parseInt(monthNumber));
    return month ? month.label : 'Unknown';
  };

  const selectedSlipAmounts = selectedSlip ? getSlipAmounts(selectedSlip) : { basicSalary: 0, deduction: 0, netSalary: 0 };

  const getStatusBadge = (isPaid) => {
    return isPaid ? 
      <Badge bg="success" className="px-3 py-2 small">
        <FaCheckCircle className="me-1" size={10} /> Paid
      </Badge> : 
      <Badge bg="warning" className="px-3 py-2 small">
        <FaClock className="me-1" size={10} /> Pending
      </Badge>;
  };

  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num === 0) return 'Zero';
    
    const numToWords = (n) => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
      if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
      if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
      return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
    };
    
    return numToWords(num) + ' Only';
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted small">Loading salary slips...</p>
        </div>
      </div>
    );
  }

  return (
    <Container fluid className="p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          <FaMoneyBillWave className="me-2 text-dark" />
          Salary Slips
        </h5>
        <Badge bg="dark" className="px-3 py-2 small">
          <FaHistory className="me-2" size={12} />
          Total Slips: {salarySlips.length}
        </Badge>
      </div>

      {/* Alert Messages */}
      {message.text && (
        <Alert 
          variant={message.type} 
          onClose={() => setMessage({ type: '', text: '' })} 
          dismissible
          className="mb-4 shadow-sm small"
        >
          {message.type === 'success' && <FaCheckCircle className="me-2" size={14} />}
          {message.type === 'info' && <FaInfoCircle className="me-2" size={14} />}
          {message.text}
        </Alert>
      )}

      {/* Joining Info Card */}
      {joiningInfo && (
        <Card className="mb-4 shadow-sm border-0 bg-white">
          <Card.Body className="p-3">
            <div className="d-flex align-items-center">
              <FaCalendarAlt className="text-dark me-3" size={20} />
              <div>
                <h5 className="mb-1 text-dark fw-semibold">Employment Start Date</h5>
                <p className="mb-0 small text-dark">
                  You joined on <strong>{joiningInfo.formattedDate}</strong>
                </p>
                <small className="text-dark small">
                  Salary slips available from {months.find(m => m.value === joiningInfo.month)?.label} {joiningInfo.year}
                </small>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}

      <Row>
        {/* Left Column - Generate Form */}
        <Col lg={4}>
          {/* Generate New Slip Card */}
          <Card className="mb-4 shadow-sm border-0">
            <Card.Header className="bg-light text-dark py-2">
              <h6 className="mb-0 fw-semibold small">
                <FaCalendarAlt className="me-2" size={14} />
                Generate New Salary Slip
              </h6>
            </Card.Header>
            <Card.Body className="p-3">
              <Form>
                {/* Year Selection */}
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-medium text-muted">Select Year</Form.Label>
                  <Form.Select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                    }}
                    size="sm"
                    className="py-2"
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {/* Month Selection */}
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-medium text-muted">Select Month</Form.Label>
                  <Form.Select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    size="sm"
                    className="py-2"
                  >
                    <option value="">Choose month...</option>
                    {months.map(month => {
                      const isCurrentMonth = month.value === currentMonth && selectedYear === currentYear;
                      return (
                        <option key={month.value} value={month.value}>
                          {month.label} {isCurrentMonth ? '(Current)' : ''}
                        </option>
                      );
                    })}
                  </Form.Select>
                  
                  {/* Show validation message if needed */}
                  {selectedMonth && selectedYear && joiningInfo && !isMonthEligible(selectedMonth, selectedYear) && (
                    <div className="mt-1 text-danger small">
                      <FaInfoCircle className="me-1" size={10} />
                      {(() => {
                        const requestedDate = new Date(selectedYear, selectedMonth - 1, 1);
                        const joiningDate = new Date(joiningInfo.year, joiningInfo.month - 1, 1);
                        if (requestedDate < joiningDate) {
                          return `Cannot generate: Before joining date (${joiningInfo.formattedDate})`;
                        }
                        return 'Cannot generate: Future month';
                      })()}
                    </div>
                  )}
                </Form.Group>

                <Button
                  variant="dark"
                  size="sm"
                  className="w-100 py-2"
                  onClick={handleGenerateSlip}
                  disabled={generating || !selectedMonth || !selectedYear}
                >
                  {generating ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FaDownload className="me-2" size={12} />
                      Generate Salary Slip
                    </>
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Column - Salary Slips History and Employee Details */}
        <Col lg={8}>
          {/* Salary Slips History Card */}
          <Card className="mb-4 shadow-sm border-0">
            <Card.Header className="bg-light text-dark py-2 d-flex justify-content-between align-items-center">
              <h6 className="mb-0 fw-semibold small">
                <FaHistory className="me-2" size={14} />
                Salary Slip History
              </h6>
              <Badge bg="light" text="dark" className="px-2 py-1 small">
                {salarySlips.length} {salarySlips.length === 1 ? 'Slip' : 'Slips'}
              </Badge>
            </Card.Header>
            <Card.Body className="p-0">
              {/* Table with Vertical Scroll */}
              <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <Table hover className="mb-0 table-sm">
                  <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                    <tr>
                      <th className="text-nowrap small text-dark fw-semibold text-center" style={{ width: '60px' }}>Sr No</th>
                      <th className="text-nowrap small text-dark fw-semibold">Month</th>
                      <th className="text-nowrap small text-dark fw-semibold">Year</th>
                      <th className="text-nowrap small text-dark fw-semibold text-end">Basic Salary</th>
                      <th className="text-nowrap small text-dark fw-semibold text-end">DT Deduction</th>
                      <th className="text-nowrap small text-dark fw-semibold text-end">Net Salary</th>
                      <th className="text-nowrap small text-dark fw-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salarySlips.length > 0 ? (
                      salarySlips.map((slip, index) => {
                        const isCurrentMonth = slip.month === currentMonth && slip.year === currentYear;
                        const { basicSalary, deduction, netSalary } = getSlipAmounts(slip);

                        return (
                          <tr key={slip.id} className={isCurrentMonth ? 'table-primary' : ''}>
                            <td className="text-center small">{index + 1}</td>
                            <td className="small">
                              <Badge bg="primary" className="px-2 py-1 small">
                                {getMonthName(slip.month)}
                                {isCurrentMonth && ' (Current)'}
                              </Badge>
                            </td>
                            <td className="fw-bold small">{slip.year}</td>
                            <td className="text-primary fw-bold small text-end">₹{formatCurrency(basicSalary)}</td>
                            <td className="text-danger small text-end">₹{formatCurrency(deduction)}</td>
                            <td className="small text-end">
                              <span className="text-success fw-bold">₹{formatCurrency(netSalary)}</span>
                            </td>
                            <td className="text-center">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => handleViewSlip(slip)}
                                className="me-1 p-1"
                                title="View Slip"
                              >
                                <FaEye size={12} />
                              </Button>
                              <Button
                                variant="outline-success"
                                size="sm"
                                onClick={() => handleDownloadPDF(slip)}
                                title="Download PDF"
                                className="p-1"
                              >
                                <FaDownload size={12} />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          <div className="mb-2">
                            <FaFilePdf size={30} className="text-muted opacity-50" />
                          </div>
                          <h6 className="text-muted small">No Salary Slips Found</h6>
                          <p className="text-muted mb-2 small">
                            {joiningInfo ? 
                              `Generate your first salary slip for ${months.find(m => m.value === joiningInfo.month)?.label} ${joiningInfo.year}` :
                              'Generate your first salary slip using the form'
                            }
                          </p>
                          <Button 
                            variant="outline-dark" 
                            size="sm"
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                          >
                            <FaCalendarAlt className="me-2" size={10} />
                            Generate Now
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          {/* Employee Details Card */}
          {employee && (
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white text-dark py-2">
                <h6 className="mb-0 fw-semibold small">
                  <FaMoneyBillWave className="me-2" size={14} />
                  Employee Details
                </h6>
              </Card.Header>
              <Card.Body className="p-3 bg-white">
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex">
                    <span className="text-muted small" style={{ minWidth: '120px' }}>Name:</span>
                    <span className="small">{employee.first_name} {employee.last_name}</span>
                  </div>
                  <div className="d-flex">
                    <span className="text-muted small" style={{ minWidth: '120px' }}>Employee ID:</span>
                    <span className="small">{employee.employee_id}</span>
                  </div>
                  <div className="d-flex">
                    <span className="text-muted small" style={{ minWidth: '120px' }}>Department:</span>
                    <span className="small">{employee.department}</span>
                  </div>
                  <div className="d-flex">
                    <span className="text-muted small" style={{ minWidth: '120px' }}>Designation:</span>
                    <span className="small">{employee.designation || employee.position}</span>
                  </div>
                  <div className="d-flex">
                    <span className="text-muted small" style={{ minWidth: '120px' }}>Joining Date:</span>
                    <span className="small">{new Date(employee.joining_date).toLocaleDateString()}</span>
                  </div>
                  <div className="d-flex">
                    <span className="text-muted small" style={{ minWidth: '120px' }}>Gross Salary:</span>
                    <span className="small">₹{formatCurrency(employee.gross_salary || employee.salary)}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* Salary Slip Modal */}
      <Modal 
        show={showSlipModal} 
        onHide={() => setShowSlipModal(false)} 
        size="lg"
        centered
        className="salary-slip-modal"
      >
        <Modal.Header closeButton className="bg-primary text-white py-2">
          <Modal.Title as="h6" className="mb-0 small fw-semibold">
            <FaFilePdf className="me-2" size={14} />
            Salary Slip
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {selectedSlip && employee && (
            <div className="salary-slip-content p-3" style={{ 
              fontFamily: 'Arial, sans-serif',
              maxWidth: '800px',
              margin: '0 auto',
              background: 'white'
            }}>
              {/* Company Header */}
              <div className="text-center mb-3">
                <h1 className="fw-bold" style={{ fontSize: '24px', color: '#000', marginBottom: '3px' }}>
                  B2BinDemand
                </h1>
                <p className="small text-muted mb-0">
                  B2BinDemand, 8th Floor SkyVista, 805, Mhada Colony, Viman Nagar, Pune, Maharashtra 411014
                </p>
              </div>

              {/* Title */}
              <h3 className="text-center fw-bold text-decoration-underline mb-3" style={{ fontSize: '16px' }}>
                Salary Slip for the month of {getMonthName(selectedSlip.month)}, {selectedSlip.year}
              </h3>

              {/* Employee Details */}
              <table className="w-100 mb-3" style={{ fontSize: '13px' }}>
                <tbody>
                  <tr>
                    <td className="py-1" style={{ width: '50%' }}>
                      <strong>Name:</strong> {employee?.first_name} {employee?.last_name}
                    </td>
                    <td className="py-1" style={{ width: '50%' }}>
                      <strong>Employee Code No:</strong> {employee?.employee_id}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1">
                      <strong>Date of Joining:</strong> {new Date(employee?.joining_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Earnings Table */}
              <table className="w-100 mb-3" style={{ fontSize: '13px' }}>
                <thead>
                  <tr className="border-top border-bottom">
                    <th className="text-start py-2 ps-2">Earnings</th>
                    <th className="text-end py-2 pe-2">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 ps-2">Basic Salary</td>
                    <td className="text-end py-1 pe-2">
                      {formatCurrency(selectedSlipAmounts.basicSalary)}
                    </td>
                  </tr>
                  <tr className="bg-light">
                    <td className="fw-bold py-1 ps-2">Gross Earnings</td>
                    <td className="text-end fw-bold py-1 pe-2">
                      {formatCurrency(selectedSlipAmounts.basicSalary)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Deductions Table */}
              <table className="w-100 mb-3" style={{ fontSize: '13px' }}>
                <thead>
                  <tr className="border-top border-bottom">
                    <th className="text-start py-2 ps-2">Deductions</th>
                    <th className="text-end py-2 pe-2">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="py-1 ps-2">PF (Provident Fund)</td><td className="text-end py-1 pe-2">0</td></tr>
                  <tr><td className="py-1 ps-2">ESI (Employee State Insurance)</td><td className="text-end py-1 pe-2">0</td></tr>
                  <tr><td className="py-1 ps-2">TDS (Tax Deducted at Source)</td><td className="text-end py-1 pe-2">0</td></tr>
                  <tr className="bg-warning bg-opacity-25">
                    <td className="fw-bold py-1 ps-2">DT (Fixed Deduction)</td>
                    <td className="text-end fw-bold text-danger py-1 pe-2">
                      {formatCurrency(selectedSlipAmounts.deduction)}
                    </td>
                  </tr>
                  <tr className="bg-light">
                    <td className="fw-bold py-1 ps-2">Total Deductions</td>
                    <td className="text-end fw-bold text-danger py-1 pe-2">
                      {formatCurrency(selectedSlipAmounts.deduction)}
                    </td>
                  </tr>
                  <tr className="fw-bold" style={{ borderTop: '2px solid #000' }}>
                    <td className="py-2 ps-2">NET SALARY</td>
                    <td className="text-end fw-bold text-success py-2 pe-2">
                      {formatCurrency(selectedSlipAmounts.netSalary)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Calculation */}
              <div className="bg-light p-2 mb-3 rounded small">
                <strong>Calculation:</strong> Basic Salary (₹{formatCurrency(selectedSlipAmounts.basicSalary)}) - DT Deduction (₹{formatCurrency(selectedSlipAmounts.deduction)}) = Net Salary (₹{formatCurrency(selectedSlipAmounts.netSalary)})
              </div>

              {/* Amount in Words */}
              <div className="small mb-4">
                <strong>Amount in Words:</strong> Rupees {numberToWords(Math.round(selectedSlipAmounts.netSalary))} Only
              </div>

              {/* Footer */}
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="small">For B2BinDemand</div>
                <div className="small">Authorized Signatory</div>
              </div>

              {/* Generated Date */}
              <div className="text-end mt-2 small text-muted">
                Generated on: {new Date().toLocaleString()}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowSlipModal(false)}>
            <FaTimes className="me-1" size={10} /> Close
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint}>
            <FaPrint className="me-1" size={10} /> Print
          </Button>
          <Button variant="success" size="sm" onClick={() => handleDownloadPDF(selectedSlip)}>
            <FaDownload className="me-1" size={10} /> Download PDF
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default SalarySlip;