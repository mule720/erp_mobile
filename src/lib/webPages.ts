// Every page of the web app's menu. The mobile app opens the ones with a native screen natively, and everything else inside the app
// (the web page, already signed in, without the web's own header and menus). Generated from the web menu: add new web pages here too.
export interface WebPage { group: string; label: string; path: string; native?: string; adminOnly?: boolean; staffOnly?: boolean }

export const WEB_PAGES: WebPage[] = [
  {
    "group": "Home & help",
    "label": "Dashboard",
    "path": "/dashboard",
    "native": "dashboard"
  },
  {
    "group": "Home & help",
    "label": "Training & Help",
    "path": "/help/training"
  },
  {
    "group": "Sales",
    "label": "Customers",
    "path": "/crm/customers",
    "native": "crm"
  },
  {
    "group": "Sales",
    "label": "Leads",
    "path": "/crm/leads",
    "native": "crm"
  },
  {
    "group": "Sales",
    "label": "Sales Intelligence",
    "path": "/crm/sales-intelligence"
  },
  {
    "group": "Sales",
    "label": "Customer Statement",
    "path": "/crm/statement"
  },
  {
    "group": "Sales",
    "label": "Sales Orders",
    "path": "/operations/sales-orders",
    "native": "sales"
  },
  {
    "group": "Sales",
    "label": "Invoices",
    "path": "/operations/invoices",
    "native": "sales"
  },
  {
    "group": "Sales",
    "label": "Quotations",
    "path": "/operations/quotations",
    "native": "sales"
  },
  {
    "group": "Sales",
    "label": "Delivery Notes",
    "path": "/operations/delivery-notes"
  },
  {
    "group": "Sales",
    "label": "POS (Point of Sale)",
    "path": "/pos",
    "native": "pos"
  },
  {
    "group": "Sales",
    "label": "Branch Performance",
    "path": "/branch-performance"
  },
  {
    "group": "Purchasing",
    "label": "Suppliers",
    "path": "/supply-chain/suppliers",
    "native": "purchasing"
  },
  {
    "group": "Purchasing",
    "label": "Requisitions",
    "path": "/supply-chain/requisitions"
  },
  {
    "group": "Purchasing",
    "label": "Purchase Orders",
    "path": "/supply-chain/purchase-orders",
    "native": "purchasing"
  },
  {
    "group": "Purchasing",
    "label": "Goods Receipt",
    "path": "/supply-chain/goods-receipt",
    "native": "purchasing"
  },
  {
    "group": "Purchasing",
    "label": "Three-Way Match",
    "path": "/supply-chain/three-way-match",
    "native": "purchasing"
  },
  {
    "group": "Purchasing",
    "label": "Supplier Evaluation",
    "path": "/supply-chain/supplier-evaluation",
    "native": "purchasing"
  },
  {
    "group": "Purchasing",
    "label": "Warehouses",
    "path": "/supply-chain/warehouses"
  },
  {
    "group": "Purchasing",
    "label": "Stock Count",
    "path": "/supply-chain/stock-count",
    "native": "purchasing"
  },
  {
    "group": "Purchasing",
    "label": "Forecast",
    "path": "/supply-chain/forecast",
    "native": "purchasing"
  },
  {
    "group": "Purchasing",
    "label": "Inventory Intelligence",
    "path": "/supply-chain/inventory-intelligence"
  },
  {
    "group": "Purchasing",
    "label": "Procurement Intelligence",
    "path": "/supply-chain/procurement-intelligence"
  },
  {
    "group": "Purchasing",
    "label": "Purchase Requirements",
    "path": "/supply-chain/purchase-requirements"
  },
  {
    "group": "Purchasing",
    "label": "Production Issues",
    "path": "/supply-chain/production"
  },
  {
    "group": "Purchasing",
    "label": "Stock Transfers",
    "path": "/supply-chain/stock-transfers"
  },
  {
    "group": "Manufacturing",
    "label": "Work Orders",
    "path": "/manufacturing/work-orders",
    "native": "manufacturing"
  },
  {
    "group": "Manufacturing",
    "label": "Production Planner",
    "path": "/manufacturing/planner",
    "native": "manufacturing"
  },
  {
    "group": "Manufacturing",
    "label": "Recipes (Bill of Materials)",
    "path": "/manufacturing/bom",
    "native": "manufacturing"
  },
  {
    "group": "Manufacturing",
    "label": "Work Centers & Routings",
    "path": "/manufacturing/work-centers"
  },
  {
    "group": "Manufacturing",
    "label": "MRP",
    "path": "/manufacturing/mrp"
  },
  {
    "group": "Manufacturing",
    "label": "AI Intelligence",
    "path": "/manufacturing/intelligence"
  },
  {
    "group": "Manufacturing",
    "label": "Machines & Maintenance",
    "path": "/manufacturing/intelligence?tab=machines"
  },
  {
    "group": "Inventory",
    "label": "Products",
    "path": "/inventory/products",
    "native": "inventory"
  },
  {
    "group": "Inventory",
    "label": "Stock Levels",
    "path": "/inventory/stock",
    "native": "inventory"
  },
  {
    "group": "Inventory",
    "label": "Categories",
    "path": "/inventory/categories",
    "native": "inventory"
  },
  {
    "group": "Inventory",
    "label": "Expiry Tracking",
    "path": "/inventory/expiry",
    "native": "inventory"
  },
  {
    "group": "Inventory",
    "label": "Serial Numbers",
    "path": "/inventory/serials"
  },
  {
    "group": "Inventory",
    "label": "Shelves",
    "path": "/inventory/shelves"
  },
  {
    "group": "Inventory",
    "label": "Wastage Notes",
    "path": "/inventory/wastage",
    "native": "inventory"
  },
  {
    "group": "Accounting",
    "label": "Journal Entries",
    "path": "/accounting/journal-entries",
    "native": "finance"
  },
  {
    "group": "Accounting",
    "label": "Payments",
    "path": "/accounting/payments",
    "native": "finance"
  },
  {
    "group": "Accounting",
    "label": "Expense Claims",
    "path": "/accounting/expense-claims",
    "native": "finance"
  },
  {
    "group": "Accounting",
    "label": "Chart of Accounts",
    "path": "/accounting/accounts"
  },
  {
    "group": "Accounting",
    "label": "Opening Balances",
    "path": "/accounting/opening-balances"
  },
  {
    "group": "Accounting",
    "label": "Petty Cash",
    "path": "/accounting/petty-cash",
    "native": "finance"
  },
  {
    "group": "Accounting",
    "label": "Wallets",
    "path": "/accounting/wallets"
  },
  {
    "group": "Accounting",
    "label": "Documents Hub",
    "path": "/accounting/documents"
  },
  {
    "group": "Accounting",
    "label": "Posting Center",
    "path": "/accounting/posting-center",
    "native": "finance"
  },
  {
    "group": "Accounting",
    "label": "Tax Centre",
    "path": "/accounting/tax"
  },
  {
    "group": "Treasury",
    "label": "Cash Position",
    "path": "/accounting/cash-position"
  },
  {
    "group": "Treasury",
    "label": "Payment Runs",
    "path": "/accounting/payment-runs"
  },
  {
    "group": "Treasury",
    "label": "Cheque Register",
    "path": "/accounting/cheques"
  },
  {
    "group": "Treasury",
    "label": "13-Week Forecast",
    "path": "/accounting/cash-forecast"
  },
  {
    "group": "Treasury",
    "label": "Debt & Facilities",
    "path": "/accounting/debt"
  },
  {
    "group": "Treasury",
    "label": "Foreign Exchange",
    "path": "/accounting/fx-exposure"
  },
  {
    "group": "Treasury",
    "label": "Bank Reconciliation",
    "path": "/accounting/bank-reconciliation",
    "native": "finance"
  },
  {
    "group": "Treasury",
    "label": "Reconciliation Assistant",
    "path": "/accounting/reconciliation-assistant"
  },
  {
    "group": "Treasury",
    "label": "Collections",
    "path": "/accounting/collections"
  },
  {
    "group": "Financial Management",
    "label": "Month-End Close",
    "path": "/accounting/close"
  },
  {
    "group": "Financial Management",
    "label": "Period Lock & Checklist",
    "path": "/accounting/period-lock"
  },
  {
    "group": "Financial Management",
    "label": "Accruals & Prepayments",
    "path": "/accounting/accruals"
  },
  {
    "group": "Financial Management",
    "label": "Variance Review",
    "path": "/accounting/variance-review"
  },
  {
    "group": "Financial Management",
    "label": "Management Pack",
    "path": "/accounting/management-pack"
  },
  {
    "group": "Financial Management",
    "label": "Journal Controls",
    "path": "/accounting/journal-controls"
  },
  {
    "group": "Financial Management",
    "label": "Budget vs Actual",
    "path": "/accounting/budget",
    "native": "finance"
  },
  {
    "group": "Financial Management",
    "label": "Budget Analysis",
    "path": "/accounting/budget-analysis"
  },
  {
    "group": "Financial Management",
    "label": "Controls & Exceptions",
    "path": "/accounting/controls",
    "adminOnly": true
  },
  {
    "group": "Financial Management",
    "label": "Compliance",
    "path": "/accounting/compliance",
    "adminOnly": true
  },
  {
    "group": "Costing",
    "label": "Cost Centres",
    "path": "/accounting/cost-centres"
  },
  {
    "group": "Costing",
    "label": "Standard Costs",
    "path": "/accounting/standard-costs"
  },
  {
    "group": "Costing",
    "label": "Job Costing",
    "path": "/accounting/job-costing"
  },
  {
    "group": "Costing",
    "label": "Profit After Costs",
    "path": "/accounting/profit-after-costs"
  },
  {
    "group": "Costing",
    "label": "Stock Valuation",
    "path": "/accounting/stock-valuation"
  },
  {
    "group": "Costing",
    "label": "Costs & Cash",
    "path": "/accounting/costs-and-cash"
  },
  {
    "group": "Finance Reports & Analysis",
    "label": "Financial Reports",
    "path": "/accounting/reports",
    "native": "finance"
  },
  {
    "group": "Finance Reports & Analysis",
    "label": "Ageing Reports",
    "path": "/accounting/ageing",
    "native": "finance"
  },
  {
    "group": "Finance Reports & Analysis",
    "label": "Analytics",
    "path": "/accounting/analytics"
  },
  {
    "group": "Finance Reports & Analysis",
    "label": "Financial Analysis",
    "path": "/accounting/financial-analysis"
  },
  {
    "group": "Finance Reports & Analysis",
    "label": "Forecast & What-if",
    "path": "/accounting/forecast"
  },
  {
    "group": "People (HR)",
    "label": "Dashboard",
    "path": "/hr/dashboard"
  },
  {
    "group": "People (HR)",
    "label": "Employees",
    "path": "/hr/employees",
    "native": "people"
  },
  {
    "group": "People (HR)",
    "label": "Payroll Runs",
    "path": "/hr/payroll",
    "native": "people"
  },
  {
    "group": "People (HR)",
    "label": "Approvals",
    "path": "/hr/approvals"
  },
  {
    "group": "People (HR)",
    "label": "Workforce Intelligence",
    "path": "/hr/workforce-intelligence"
  },
  {
    "group": "People (HR)",
    "label": "Compliance",
    "path": "/hr/compliance",
    "native": "people"
  },
  {
    "group": "People (HR)",
    "label": "Payments",
    "path": "/hr/payments"
  },
  {
    "group": "People (HR)",
    "label": "Reports",
    "path": "/hr/reports",
    "native": "people"
  },
  {
    "group": "People (HR)",
    "label": "Attendance",
    "path": "/hr/attendance",
    "native": "people"
  },
  {
    "group": "People (HR)",
    "label": "Timesheets",
    "path": "/hr/timesheets",
    "native": "people"
  },
  {
    "group": "People (HR)",
    "label": "Overtime",
    "path": "/hr/overtime",
    "native": "people"
  },
  {
    "group": "People (HR)",
    "label": "Contract Management",
    "path": "/hr/contracts"
  },
  {
    "group": "People (HR)",
    "label": "Leave",
    "path": "/hr/leave",
    "native": "people"
  },
  {
    "group": "People (HR)",
    "label": "Benefits & Deductions",
    "path": "/hr/benefits"
  },
  {
    "group": "People (HR)",
    "label": "Gratuity",
    "path": "/hr/gratuity"
  },
  {
    "group": "People (HR)",
    "label": "Loans & Advances",
    "path": "/hr/loans",
    "native": "people"
  },
  {
    "group": "People (HR)",
    "label": "Leave Calendar",
    "path": "/hr/leave-calendar"
  },
  {
    "group": "People (HR)",
    "label": "Goals & Appraisals",
    "path": "/hr/performance"
  },
  {
    "group": "People (HR)",
    "label": "Employee Requests",
    "path": "/hr/requests"
  },
  {
    "group": "People (HR)",
    "label": "Notices & Policies",
    "path": "/hr/notices"
  },
  {
    "group": "People (HR)",
    "label": "Payslip Templates",
    "path": "/hr/payslip-templates"
  },
  {
    "group": "People (HR)",
    "label": "Self-Service",
    "path": "/hr/self-service"
  },
  {
    "group": "People (HR)",
    "label": "Statutory Reports",
    "path": "/hr/statutory"
  },
  {
    "group": "People (HR)",
    "label": "MarketHub Staff",
    "path": "/hr/markethub-staff",
    "adminOnly": true
  },
  {
    "group": "Fixed Assets",
    "label": "Asset Register",
    "path": "/fixed-assets/register",
    "native": "fixed_assets"
  },
  {
    "group": "Fixed Assets",
    "label": "Depreciation",
    "path": "/fixed-assets/depreciation",
    "native": "fixed_assets"
  },
  {
    "group": "Fixed Assets",
    "label": "Maintenance",
    "path": "/fixed-assets/maintenance",
    "native": "fixed_assets"
  },
  {
    "group": "Fixed Assets",
    "label": "Transfers",
    "path": "/fixed-assets/transfers"
  },
  {
    "group": "Fixed Assets",
    "label": "Categories",
    "path": "/fixed-assets/categories",
    "native": "fixed_assets"
  },
  {
    "group": "Tax Hub",
    "label": "Overview",
    "path": "/tax",
    "native": "tax_hub"
  },
  {
    "group": "Tax Hub",
    "label": "Tax Rates",
    "path": "/tax/rates",
    "native": "tax_hub"
  },
  {
    "group": "Tax Hub",
    "label": "Tax Setup",
    "path": "/tax/setup",
    "adminOnly": true
  },
  {
    "group": "Tax Hub",
    "label": "Tax Calendar",
    "path": "/tax/calendar",
    "native": "tax_hub"
  },
  {
    "group": "Tax Hub",
    "label": "Tax Reports",
    "path": "/tax/reports",
    "native": "tax_hub"
  },
  {
    "group": "Tax Hub",
    "label": "ZRA Smart Invoice",
    "path": "/tax/smart-invoice",
    "native": "tax_hub"
  },
  {
    "group": "Business suite",
    "label": "Projects",
    "path": "/business-suite/projects",
    "native": "projects"
  },
  {
    "group": "Business suite",
    "label": "Project Intelligence",
    "path": "/business-suite/project-intelligence"
  },
  {
    "group": "Business suite",
    "label": "Service Tickets",
    "path": "/business-suite/service-tickets",
    "native": "projects"
  },
  {
    "group": "Business suite",
    "label": "Support Insights",
    "path": "/business-suite/support-insights"
  },
  {
    "group": "Setup & Import",
    "label": "Data Import",
    "path": "/setup/import",
    "native": "setup",
    "adminOnly": true
  },
  {
    "group": "Setup & Import",
    "label": "Migration Studio",
    "path": "/setup/migration-studio",
    "adminOnly": true
  },
  {
    "group": "Settings",
    "label": "Company Setup",
    "path": "/settings/general",
    "adminOnly": true
  },
  {
    "group": "Settings",
    "label": "Branches",
    "path": "/settings/branches",
    "adminOnly": true
  },
  {
    "group": "Settings",
    "label": "POS Terminals",
    "path": "/settings/terminals",
    "adminOnly": true
  },
  {
    "group": "Settings",
    "label": "Billing",
    "path": "/settings/billing"
  },
  {
    "group": "Settings",
    "label": "Integrations",
    "path": "/settings/integrations",
    "adminOnly": true
  },
  {
    "group": "Settings",
    "label": "AI centre",
    "path": "/settings/ai-centre",
    "native": "ai_centre"
  },
  {
    "group": "Settings",
    "label": "Business rules",
    "path": "/settings/business-rules",
    "adminOnly": true
  },
  {
    "group": "Settings",
    "label": "Workflow assistant",
    "path": "/settings/workflow-assistant",
    "adminOnly": true
  },
  {
    "group": "Settings",
    "label": "Staff & Access",
    "path": "/settings/users",
    "native": "setup",
    "adminOnly": true
  },
  {
    "group": "Settings",
    "label": "Roles & Permissions",
    "path": "/settings/roles",
    "native": "setup",
    "adminOnly": true
  },
  {
    "group": "Settings",
    "label": "My Self-Service",
    "path": "/hr/self-service"
  },
  {
    "group": "Platform Admin",
    "label": "Overview",
    "path": "/platform-admin?tab=overview",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Tenants",
    "path": "/platform-admin?tab=tenants",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Registrations",
    "path": "/platform-admin?tab=registrations",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Subscriptions",
    "path": "/platform-admin/subscriptions",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Quotations",
    "path": "/platform-admin?tab=quotations",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Revenue",
    "path": "/platform-admin?tab=revenue",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Wallets",
    "path": "/platform-admin?tab=wallets",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Audit Logs",
    "path": "/platform-admin?tab=audit",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Support",
    "path": "/platform-admin?tab=support",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Integrations",
    "path": "/platform-admin?tab=integrations",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Announcements",
    "path": "/platform-admin?tab=announcements",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "API Keys",
    "path": "/platform-admin?tab=apikeys",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Staff Access",
    "path": "/platform-admin?tab=access",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "System Health",
    "path": "/platform-admin?tab=health",
    "staffOnly": true
  },
  {
    "group": "Platform Admin",
    "label": "Staff Permissions",
    "path": "/platform-admin?tab=staff",
    "staffOnly": true
  }
];
