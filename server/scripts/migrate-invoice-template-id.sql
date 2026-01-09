-- 发票模版ID字段迁移
-- 添加 template_id 字段到 invoices 表
-- 更新默认发票模版的公司信息
-- 创建日期: 2026-01-09

-- ==================== 第一部分：发票表添加字段 ====================

-- 添加 template_id 字段到 invoices 表
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES invoice_templates(id);

-- 添加注释
COMMENT ON COLUMN invoices.template_id IS '发票模版ID，关联 invoice_templates 表';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_invoices_template_id ON invoices(template_id);

-- ==================== 第二部分：更新默认发票模版 ====================

-- 更新默认模版的公司信息（原有 COMPANY_INFO 配置）
UPDATE invoice_templates
SET 
  content = '{
    "zh": {
      "companyName": "先锋国际物流",
      "companyAddress": "No. RM 725,7/F.,Liven House 61-63 King Yip Street, Kwun Tong Hong Kong, China",
      "companyCity": "Hong Kong",
      "companyCountry": "China",
      "companyPostcode": "",
      "companyPhone": "",
      "companyEmail": "",
      "companyWebsite": "",
      "taxNumber": "",
      "registrationNumber": "77224366-000-10-24-A",
      "bankName": "东亚银行",
      "bankAddress": "10 Des Voeux Road, Central, Hong Kong",
      "accountName": "Xianfeng International Logistics",
      "accountNumber": "015-150-68-100225",
      "swiftCode": "BEASKHHH",
      "sortCode": "015 (for local interbank transfers)",
      "footerNote": "",
      "thankYouMessage": "感谢您的惠顾！",
      "labelInvoice": "发票",
      "labelInvoiceNumber": "发票号",
      "labelDate": "日期",
      "labelDueDate": "到期日",
      "labelBillTo": "收票方",
      "labelDescription": "描述",
      "labelQuantity": "数量",
      "labelUnitPrice": "单价",
      "labelAmount": "金额",
      "labelSubtotal": "小计",
      "labelTax": "税额",
      "labelTotal": "总计",
      "labelBankDetails": "银行信息",
      "labelPaymentTerms": "付款条款"
    },
    "en": {
      "companyName": "Xianfeng International Logistics",
      "companyAddress": "No. RM 725,7/F.,Liven House 61-63 King Yip Street, Kwun Tong Hong Kong, China",
      "companyCity": "Hong Kong",
      "companyCountry": "China",
      "companyPostcode": "",
      "companyPhone": "",
      "companyEmail": "",
      "companyWebsite": "",
      "taxNumber": "",
      "registrationNumber": "77224366-000-10-24-A",
      "bankName": "The Bank of East Asia, Limited",
      "bankAddress": "10 Des Voeux Road, Central, Hong Kong",
      "accountName": "Xianfeng International Logistics",
      "accountNumber": "015-150-68-100225",
      "swiftCode": "BEASKHHH",
      "sortCode": "015 (for local interbank transfers)",
      "footerNote": "",
      "thankYouMessage": "Thank you for your business!",
      "labelInvoice": "INVOICE",
      "labelInvoiceNumber": "Invoice No.",
      "labelDate": "Invoice Date",
      "labelDueDate": "Due Date",
      "labelBillTo": "Bill to",
      "labelDescription": "Service Description",
      "labelQuantity": "Quantity",
      "labelUnitPrice": "Unit Value",
      "labelAmount": "Amount",
      "labelSubtotal": "Sub Total",
      "labelTax": "Tax",
      "labelTotal": "Total",
      "labelBankDetails": "Bank Details",
      "labelPaymentTerms": "Payment Terms"
    }
  }'::jsonb,
  updated_at = NOW()
WHERE is_default = true AND is_deleted = false;

-- ==================== 验证结果 ====================

-- 验证 invoices 表字段
SELECT 'invoices 表 template_id 字段' as check_item, 
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'invoices' AND column_name = 'template_id'
       ) THEN '已添加' ELSE '未添加' END as status;

-- 验证默认模版内容
SELECT 'invoice_templates 默认模版' as check_item,
       template_name,
       CASE WHEN content->>'zh' IS NOT NULL AND content->'zh'->>'companyName' != '' 
            THEN '已配置公司信息' 
            ELSE '未配置' END as zh_status,
       CASE WHEN content->>'en' IS NOT NULL AND content->'en'->>'companyName' != '' 
            THEN '已配置公司信息' 
            ELSE '未配置' END as en_status
FROM invoice_templates 
WHERE is_default = true AND is_deleted = false;
